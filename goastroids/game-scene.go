package goastroids

import (
	"fmt"
	"image/color"
	"math"

	"gamet/assets"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/inpututil"
	"github.com/hajimehoshi/ebiten/v2/text/v2"
	"github.com/hajimehoshi/ebiten/v2/vector"
)

type TurnPhase int

const (
	PhaseAiming TurnPhase = iota
	PhaseShooting
	PhaseFlying
	PhaseHolding
	PhaseTransition
	PhaseGameOver
)

type GameScene struct {
	players           [2]*Player
	activePlayerIndex int
	phase             TurnPhase
	roundNumber       int

	// Projectiles and Visuals
	currentArrow *Arrow
	stuckArrows  []*Arrow
	explosions   []*Explosion

	// Camera coordinates
	camX float64
	camY float64

	// Timers for turn transitions
	holdTicks int

	// Virtual Buttons
	fireButton    *VirtualButton
	angleUpBtn    *VirtualButton
	angleDownBtn  *VirtualButton
	powerUpBtn    *VirtualButton
	powerDownBtn  *VirtualButton
	restartButton *VirtualButton

	// Environmental clouds
	clouds [][3]float64 // [x, y, speed]
}

func NewGameScene() *GameScene {
	g := &GameScene{
		phase:             PhaseAiming,
		activePlayerIndex: 0,
		roundNumber:       1,
		stuckArrows:       make([]*Arrow, 0, 32),
		explosions:        make([]*Explosion, 0, 16),
		clouds:            generateClouds(12),
	}

	// Player 1 on the left (facing right), Player 2 on the right (facing left)
	g.players[0] = NewPlayer(g, 1, Player1StartX, DefaultGroundY, true)
	g.players[1] = NewPlayer(g, 2, Player2StartX, DefaultGroundY, false)

	// Virtual Controls
	// Main Fire button at bottom right
	g.fireButton = NewVirtualButton(715, 505, 48, "FIRE", "[SPACE]", ebiten.KeySpace)

	// Angle adjustment buttons
	g.angleUpBtn = NewVirtualButton(715, 395, 25, "▲", "ANG", ebiten.KeyUp)
	g.angleDownBtn = NewVirtualButton(635, 435, 25, "▼", "ANG", ebiten.KeyDown)

	// Power adjustment buttons
	g.powerUpBtn = NewVirtualButton(635, 510, 25, "+P", "PWR", ebiten.KeyRight)
	g.powerDownBtn = NewVirtualButton(555, 510, 25, "-P", "PWR", ebiten.KeyLeft)

	// Rematch button on Game Over
	g.restartButton = NewVirtualButton(float32(ScreenWidth)/2, 380, 50, "REMATCH", "[SPACE]", ebiten.KeySpace)

	// Initialize camera centered on Player 1
	g.camX = 0
	g.camY = 0

	return g
}

func generateClouds(count int) [][3]float64 {
	clouds := make([][3]float64, count)
	for i := 0; i < count; i++ {
		clouds[i] = [3]float64{
			float64(i * 180),
			float64(40 + (i*37)%140),
			0.15 + float64(i%3)*0.08,
		}
	}
	return clouds
}

// ActivePlayer returns the player whose turn it currently is.
func (g *GameScene) ActivePlayer() *Player {
	return g.players[g.activePlayerIndex]
}

// OpponentPlayer returns the defending player.
func (g *GameScene) OpponentPlayer() *Player {
	return g.players[1-g.activePlayerIndex]
}

// SpawnArrow is invoked by the active Player on the attack release frame.
func (g *GameScene) SpawnArrow(x, y, speed, angleRad float64, shooter int) {
	g.currentArrow = NewArrow(x, y, speed, angleRad, shooter)
	g.phase = PhaseFlying
}

func (g *GameScene) Update(state *State) error {
	dt := 1.0 / 60.0

	// Update clouds drift across the large world
	for i := range g.clouds {
		g.clouds[i][0] += g.clouds[i][2]
		if g.clouds[i][0] > float64(WorldWidth)+150 {
			g.clouds[i][0] = -150
		}
	}

	// Update players
	g.players[0].Update()
	g.players[1].Update()

	// Update active explosions
	for _, e := range g.explosions {
		e.Update()
	}
	activeExpl := g.explosions[:0]
	for _, e := range g.explosions {
		if e.Active {
			activeExpl = append(activeExpl, e)
		}
	}
	g.explosions = activeExpl

	switch g.phase {
	case PhaseGameOver:
		g.restartButton.Update()
		if g.restartButton.IsJustPressed() || inpututil.IsKeyJustPressed(ebiten.KeySpace) || inpututil.IsKeyJustPressed(ebiten.KeyEnter) {
			state.SceneManager.GoToScene(NewGameScene())
		}
		g.updateCamera(g.OpponentPlayer().position.X, g.OpponentPlayer().position.Y, false)
		return nil

	case PhaseAiming:
		active := g.ActivePlayer()

		// 1. Update Virtual Buttons
		g.fireButton.Update()
		g.angleUpBtn.Update()
		g.angleDownBtn.Update()
		g.powerUpBtn.Update()
		g.powerDownBtn.Update()

		// Angle adjustment: Facing right uses +angle for downwards / -angle for upwards;
		// AdjustAngle clamps appropriately.
		angleStep := 0.02
		if !active.FacingRight {
			angleStep = -0.02
		}
		if g.angleUpBtn.IsPressed() || ebiten.IsKeyPressed(ebiten.KeyUp) || ebiten.IsKeyPressed(ebiten.KeyW) {
			active.AdjustAngle(-angleStep)
		}
		if g.angleDownBtn.IsPressed() || ebiten.IsKeyPressed(ebiten.KeyDown) || ebiten.IsKeyPressed(ebiten.KeyS) {
			active.AdjustAngle(angleStep)
		}

		// Power adjustment
		if g.powerUpBtn.IsPressed() || ebiten.IsKeyPressed(ebiten.KeyRight) || ebiten.IsKeyPressed(ebiten.KeyD) {
			active.AdjustPower(8.0)
		}
		if g.powerDownBtn.IsPressed() || ebiten.IsKeyPressed(ebiten.KeyLeft) || ebiten.IsKeyPressed(ebiten.KeyA) {
			active.AdjustPower(-8.0)
		}

		// Direct touch / click on playfield to set angle and power
		mx, my := ebiten.CursorPosition()
		btnDist := g.fireButton.DistanceTo(float32(mx), float32(my))
		if btnDist > 75 && my < ScreenHeight-90 && my > 80 {
			if ebiten.IsMouseButtonPressed(ebiten.MouseButtonLeft) {
				worldMX := float64(mx) + g.camX
				worldMY := float64(my) + g.camY
				bowX, bowY := active.BowPosition()
				dx := worldMX - bowX
				dy := worldMY - bowY
				dragDist := math.Hypot(dx, dy)
				if dragDist > 20 {
					targetAngle := math.Atan2(dy, dx)
					active.AimAngle = targetAngle
					active.AdjustAngle(0) // apply clamps

					// Scale power by drag distance
					calculatedPower := dragDist * 3.8
					if calculatedPower >= MinPower && calculatedPower <= MaxPower {
						active.AimPower = calculatedPower
					}
				}
			}
		}

		// Fire Action Trigger
		if g.fireButton.IsJustPressed() || inpututil.IsKeyJustPressed(ebiten.KeySpace) || inpututil.IsKeyJustPressed(ebiten.KeyEnter) {
			g.phase = PhaseShooting
			active.TriggerAttack()
		}

		g.updateCamera(active.position.X, active.position.Y, false)

	case PhaseShooting:
		// Waiting for the attack animation to reach frame 6 and spawn the arrow
		g.updateCamera(g.ActivePlayer().position.X, g.ActivePlayer().position.Y, false)

	case PhaseFlying:
		if g.currentArrow != nil {
			g.currentArrow.Update(dt, DefaultGroundY)

			// Check collision with opponent archer using full-body Continuous Collision Detection (CCD)
			targetPlayer := g.players[2-g.currentArrow.Shooter]
			if g.currentArrow.CollidesWithPlayer(targetPlayer) {
				g.currentArrow.State = ArrowHit
				g.currentArrow.Trail = nil // Reset trajectory line immediately on impact
				damage := 35 + (g.roundNumber * 5)
				targetPlayer.TakeDamage(damage)
				targetPlayer.ApplyKnockback(g.currentArrow.ShootingPower, g.currentArrow.ShootingAngle, g.currentArrow.VX)
				g.explosions = append(g.explosions, NewExplosion(g.currentArrow.X, g.currentArrow.Y))

				if targetPlayer.IsDead() {
					g.phase = PhaseGameOver
					return nil
				}
				g.phase = PhaseHolding
				g.holdTicks = 85 // Allow player to complete their dramatic airborne jump, backflip, and landing
				return nil
			}

			// Check if arrow landed in the ground (even outside scene bounds)
			if g.currentArrow.State == ArrowStuck {
				g.currentArrow.Trail = nil // Reset trajectory line when shot lands
				g.stuckArrows = append(g.stuckArrows, g.currentArrow)
				g.phase = PhaseHolding
				g.holdTicks = 55 // hold on impact point
				return nil
			}

			// Check if arrow became inactive
			if !g.currentArrow.Active {
				g.phase = PhaseHolding
				g.holdTicks = 35
				return nil
			}

			// Camera tracks the flying arrow horizontally and vertically across and outside the scene!
			g.updateCamera(g.currentArrow.X, g.currentArrow.Y, true)
		}

	case PhaseHolding:
		g.holdTicks--
		opponent := g.OpponentPlayer()
		// Camera smoothly follows the tumbling airborne player or the impact point
		if opponent.IsAirborne() {
			g.updateCamera(opponent.position.X, opponent.position.Y, true)
		} else if g.currentArrow != nil {
			g.updateCamera(g.currentArrow.X, g.currentArrow.Y, true)
		}

		if g.holdTicks <= 0 && !opponent.IsAirborne() {
			// Change turn to the other side archer once landing is complete!
			g.activePlayerIndex = 1 - g.activePlayerIndex
			g.phase = PhaseTransition
			if g.currentArrow != nil {
				g.currentArrow.Trail = nil
			}
			g.currentArrow = nil
			if g.activePlayerIndex == 0 {
				g.roundNumber++
			}
		}

	case PhaseTransition:
		// Smoothly pan camera over the battlefield to the other archer, returning altitude to ground level
		targetX := g.ActivePlayer().position.X
		targetCamX := targetX - float64(ScreenWidth)/2.0
		if targetCamX < 0 {
			targetCamX = 0
		}
		if targetCamX > float64(WorldWidth-ScreenWidth) {
			targetCamX = float64(WorldWidth - ScreenWidth)
		}

		g.camX += (targetCamX - g.camX) * 0.07
		g.camY += (0.0 - g.camY) * 0.08 // return to ground horizon

		if math.Abs(g.camX-targetCamX) < 14 && math.Abs(g.camY) < 10 {
			g.camX = targetCamX
			g.camY = 0
			g.phase = PhaseAiming
		}
	}

	return nil
}

// updateCamera smoothly lerps camera position toward (focusX, focusY), with sky/outside scene support.
func (g *GameScene) updateCamera(focusX, focusY float64, allowOutside bool) {
	targetCamX := focusX - float64(ScreenWidth)/2.0
	minCamX := 0.0
	maxCamX := float64(WorldWidth - ScreenWidth)
	if allowOutside {
		// When tracking flying arrows, allow camera to follow outside the scene!
		minCamX = -600.0
		maxCamX = float64(WorldWidth-ScreenWidth) + 600.0
	}
	if targetCamX < minCamX {
		targetCamX = minCamX
	}
	if targetCamX > maxCamX {
		targetCamX = maxCamX
	}
	g.camX += (targetCamX - g.camX) * 0.08

	// Vertical tracking: tilt up when arrow soars high into the sky!
	targetCamY := 0.0
	if allowOutside && focusY < 180.0 {
		targetCamY = focusY - 180.0
		if targetCamY < -1000.0 {
			targetCamY = -1000.0
		}
	}
	g.camY += (targetCamY - g.camY) * 0.09
}

func (g *GameScene) Draw(screen *ebiten.Image) {
	// 1. Sky Gradient
	vector.DrawFilledRect(screen, 0, 0, ScreenWidth, ScreenHeight, color.RGBA{18, 24, 40, 255}, false)

	// Sun / Moon in the sky
	vector.DrawFilledCircle(screen, 400-float32(g.camX*0.1), 110, 36, color.RGBA{255, 235, 180, 220}, true)
	vector.DrawFilledCircle(screen, 400-float32(g.camX*0.1), 110, 48, color.RGBA{255, 235, 180, 40}, true)

	// Drifting Clouds (parallax speed 0.4)
	for _, c := range g.clouds {
		cx := float32(c[0] - g.camX*0.4)
		cy := float32(c[1])
		if cx > -120 && cx < ScreenWidth+120 {
			vector.DrawFilledCircle(screen, cx, cy, 32, color.RGBA{60, 75, 105, 110}, true)
			vector.DrawFilledCircle(screen, cx+26, cy-6, 26, color.RGBA{60, 75, 105, 110}, true)
			vector.DrawFilledCircle(screen, cx-24, cy+4, 24, color.RGBA{60, 75, 105, 110}, true)
		}
	}

	// Distant Mountains silhouette (parallax 0.3)
	mountainBaseY := float32(DefaultGroundY - 40 - g.camY*0.4)
	for x := float32(-400); x < float32(WorldWidth+400); x += 220 {
		mountainBaseX := x - float32(g.camX*0.3)
		vector.DrawFilledCircle(screen, mountainBaseX, mountainBaseY, 160, color.RGBA{28, 36, 56, 255}, true)
	}

	// 2. Ground and battlefield terrain (extends outside scene so off-screen shots land seamlessly)
	groundY := float32(DefaultGroundY + 2 - g.camY)
	vector.DrawFilledRect(screen, -100, groundY, float32(ScreenWidth)+200, float32(ScreenHeight)-groundY+800, color.RGBA{38, 48, 68, 255}, false)
	vector.StrokeLine(screen, -100, groundY, float32(ScreenWidth)+200, groundY, 3.5, color.RGBA{72, 105, 145, 255}, false)

	// Decorative grass blades along ground
	for wx := float64(-300); wx < float64(WorldWidth+300); wx += 28 {
		sx := float32(wx - g.camX)
		if sx > -20 && sx < ScreenWidth+20 {
			vector.DrawFilledRect(screen, sx, groundY-5, 8, 5, color.RGBA{95, 145, 190, 200}, false)
		}
	}

	// Archer 1 Base Pedestal & Flag (World X ~ 220)
	g.drawBaseFort(screen, Player1StartX, groundY, color.RGBA{235, 185, 50, 255}, "P1")
	// Archer 2 Base Pedestal & Flag (World X ~ 1780)
	g.drawBaseFort(screen, Player2StartX, groundY, color.RGBA{50, 185, 245, 255}, "P2")

	// 3. Draw Stuck Arrows embedded in the earth
	for _, a := range g.stuckArrows {
		a.Draw(screen, g.camX, g.camY)
	}

	// 4. Draw Flying Arrow
	if g.currentArrow != nil {
		g.currentArrow.Draw(screen, g.camX, g.camY)
	}

	// 5. Draw Both Archers
	g.players[0].Draw(screen, g.camX, g.camY)
	g.players[1].Draw(screen, g.camX, g.camY)

	// 6. Draw Explosions
	for _, e := range g.explosions {
		e.Draw(screen, g.camX, g.camY)
	}

	// 7. Draw HUD (Health bars, active turn indicator, shot stats)
	g.drawHUD(screen)

	// 8. Draw Virtual Buttons (fixed in screen space for touch and click)
	if g.phase == PhaseAiming {
		g.fireButton.Draw(screen)
		g.angleUpBtn.Draw(screen)
		g.angleDownBtn.Draw(screen)
		g.powerUpBtn.Draw(screen)
		g.powerDownBtn.Draw(screen)
	}

	// 9. Draw Game Over screen
	if g.phase == PhaseGameOver {
		g.drawGameOver(screen)
	}
}

// drawBaseFort draws an aesthetic team banner/stone platform for each archer.
func (g *GameScene) drawBaseFort(screen *ebiten.Image, worldX float64, groundY float32, teamColor color.RGBA, tag string) {
	sx := float32(worldX - g.camX)
	if sx < -100 || sx > ScreenWidth+100 {
		return
	}

	// Stone platform
	vector.DrawFilledRect(screen, sx-60, groundY, 120, 18, color.RGBA{50, 60, 85, 255}, false)
	vector.StrokeLine(screen, sx-60, groundY, sx+60, groundY, 2.0, teamColor, false)

	// Flagpole
	flagX := sx - 45
	if tag == "P2" {
		flagX = sx + 45
	}
	vector.StrokeLine(screen, flagX, groundY-80, flagX, groundY, 2.5, color.RGBA{180, 195, 215, 255}, false)
	// Flag banner
	flagDir := float32(24)
	if tag == "P2" {
		flagDir = -24
	}
	vector.DrawFilledRect(screen, flagX, groundY-80, flagDir, 16, teamColor, false)
}

func (g *GameScene) drawHUD(screen *ebiten.Image) {
	// Top Header Bar
	vector.DrawFilledRect(screen, 0, 0, ScreenWidth, 75, color.RGBA{10, 14, 24, 210}, false)
	vector.StrokeLine(screen, 0, 75, ScreenWidth, 75, 1.5, color.RGBA{55, 75, 110, 180}, false)

	// Player 1 Health Bar (Top Left)
	g.drawHealthBar(screen, 25, 20, 220, 22, g.players[0], color.RGBA{240, 180, 40, 255})

	// Player 2 Health Bar (Top Right)
	g.drawHealthBar(screen, ScreenWidth-245, 20, 220, 22, g.players[1], color.RGBA{50, 180, 245, 255})

	// Center Turn Banner
	active := g.ActivePlayer()
	turnColor := color.RGBA{255, 210, 50, 255}
	if active.ID == 2 {
		turnColor = color.RGBA{70, 200, 255, 255}
	}

	turnText := fmt.Sprintf("%s'S TURN", active.Name)
	if g.phase == PhaseFlying {
		turnText = "ARROW IN FLIGHT..."
	} else if g.phase == PhaseTransition {
		turnText = "SWITCHING SIDES..."
	}

	topOp := &text.DrawOptions{}
	topOp.LayoutOptions.PrimaryAlign = text.AlignCenter
	topOp.ColorScale.ScaleWithColor(turnColor)
	topOp.GeoM.Translate(float64(ScreenWidth)/2, 16)
	text.Draw(screen, turnText, &text.GoTextFace{
		Source: assets.TitleFont,
		Size:   24,
	}, topOp)

	// Round indicator
	roundOp := &text.DrawOptions{}
	roundOp.LayoutOptions.PrimaryAlign = text.AlignCenter
	roundOp.ColorScale.ScaleWithColor(color.RGBA{160, 180, 210, 190})
	roundOp.GeoM.Translate(float64(ScreenWidth)/2, 45)
	text.Draw(screen, fmt.Sprintf("ROUND %d", g.roundNumber), &text.GoTextFace{
		Source: assets.TitleFont,
		Size:   14,
	}, roundOp)

	// Bottom Stats Console (Angle & Power readout for active player)
	if g.phase == PhaseAiming {
		g.drawStatsConsole(screen, active)
	}
}

func (g *GameScene) drawHealthBar(screen *ebiten.Image, x, y, width, height float32, p *Player, teamColor color.RGBA) {
	// Background slot
	vector.DrawFilledRect(screen, x, y, width, height, color.RGBA{25, 30, 45, 230}, false)
	vector.StrokeRect(screen, x, y, width, height, 1.8, teamColor, false)

	// Filled HP bar
	hpPct := float32(p.Health) / float32(p.MaxHealth)
	if hpPct < 0 {
		hpPct = 0
	}
	barColor := color.RGBA{R: 50, G: 210, B: 90, A: 240}
	if hpPct < 0.35 {
		barColor = color.RGBA{R: 240, G: 60, B: 60, A: 240}
	} else if hpPct < 0.65 {
		barColor = color.RGBA{R: 240, G: 180, B: 40, A: 240}
	}
	vector.DrawFilledRect(screen, x+2, y+2, (width-4)*hpPct, height-4, barColor, false)

	// Name and HP text
	nameOp := &text.DrawOptions{}
	nameOp.ColorScale.ScaleWithColor(color.RGBA{255, 255, 255, 240})
	nameOp.GeoM.Translate(float64(x+6), float64(y+2))
	text.Draw(screen, fmt.Sprintf("%s : %d HP", p.Name, p.Health), &text.GoTextFace{
		Source: assets.TitleFont,
		Size:   14,
	}, nameOp)
}

func (g *GameScene) drawStatsConsole(screen *ebiten.Image, p *Player) {
	// Glassmorphic console backdrop at bottom left
	vector.DrawFilledRect(screen, 25, ScreenHeight-80, 280, 60, color.RGBA{18, 24, 38, 220}, false)
	vector.StrokeRect(screen, 25, ScreenHeight-80, 280, 60, 1.5, color.RGBA{65, 88, 128, 200}, false)

	// Angle and Power readout
	angleDeg := p.GetAngleDegrees()
	powerPct := int(math.Round((p.AimPower - MinPower) / (MaxPower - MinPower) * 100))

	statText := fmt.Sprintf("ANGLE: %d°  |  POWER: %d%%", angleDeg, powerPct)
	statOp := &text.DrawOptions{}
	statOp.ColorScale.ScaleWithColor(color.RGBA{255, 225, 90, 255})
	statOp.GeoM.Translate(40, float64(ScreenHeight)-72)
	text.Draw(screen, statText, &text.GoTextFace{
		Source: assets.TitleFont,
		Size:   17,
	}, statOp)

	// Power Gauge Bar
	barWidth := float32(240)
	vector.DrawFilledRect(screen, 40, ScreenHeight-46, barWidth, 12, color.RGBA{30, 40, 60, 255}, false)
	filledW := barWidth * (float32(powerPct) / 100.0)
	vector.DrawFilledRect(screen, 40, ScreenHeight-46, filledW, 12, color.RGBA{245, 140, 30, 255}, false)
	vector.StrokeRect(screen, 40, ScreenHeight-46, barWidth, 12, 1.0, color.RGBA{200, 215, 240, 150}, false)
}

func (g *GameScene) drawGameOver(screen *ebiten.Image) {
	vector.DrawFilledRect(screen, 0, 0, ScreenWidth, ScreenHeight, color.RGBA{8, 12, 20, 225}, false)

	winner := g.ActivePlayer()
	if g.OpponentPlayer().IsDead() {
		winner = g.ActivePlayer()
	} else {
		winner = g.OpponentPlayer()
	}

	winOp := &text.DrawOptions{}
	winOp.LayoutOptions.PrimaryAlign = text.AlignCenter
	winOp.ColorScale.ScaleWithColor(color.RGBA{255, 215, 60, 255})
	winOp.GeoM.Translate(float64(ScreenWidth)/2, 170)
	text.Draw(screen, fmt.Sprintf("%s WINS!", winner.Name), &text.GoTextFace{
		Source: assets.TitleFont,
		Size:   54,
	}, winOp)

	subOp := &text.DrawOptions{}
	subOp.LayoutOptions.PrimaryAlign = text.AlignCenter
	subOp.ColorScale.ScaleWithColor(color.RGBA{200, 220, 255, 200})
	subOp.GeoM.Translate(float64(ScreenWidth)/2, 250)
	text.Draw(screen, fmt.Sprintf("VICTORY IN %d ROUNDS", g.roundNumber), &text.GoTextFace{
		Source: assets.TitleFont,
		Size:   22,
	}, subOp)

	g.restartButton.Draw(screen)
}

func (g *GameScene) Layout(outsideWidth, outsideHeight int) (screenWidth, screenHeight int) {
	return outsideWidth, outsideHeight
}