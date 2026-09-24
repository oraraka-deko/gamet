package goastroids

import (
	"image/color"
	"math"

	"gamet/assets"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/vector"
)

type ArcherState int

const (
	ArcherIdle ArcherState = iota
	ArcherAttack
	ArcherHurt
	ArcherDie
)

type Player struct {
	game               *GameScene
	ID                 int
	position           Vector
	FacingRight        bool
	state              ArcherState
	currentFrame       int
	frameTicks         int
	ticksPerFrame      int
	AimAngle           float64 // Radians
	AimPower           float64 // Pixels per second (500 - 1900)
	Health             int
	MaxHealth          int
	invulnerableTicks  int
	hasShotCurrentAnim bool
	scale              float64
	Name               string

	// Airborne dramatic jump & backflip physics
	launchVX            float64
	launchVY            float64
	rotation            float64
	rotVelocity         float64
	isAirborne          bool
	starAngle           float64
	ShootOutMultiplier  float64
}

// ShootOutFactor is the global variable controlling how much a player gets shot out / launched when hit.
// It is calculated dynamically based on arrow angle + arrow shooting power.
// Adjust this variable to scale the overall shoot-out distance and height.
var ShootOutFactor = 1.0

const (
	Player1StartX     = 220.0
	Player2StartX     = 1780.0
	ArcherSpriteScale = 0.28
	MinPower          = 500.0
	MaxPower          = 1900.0
	DefaultPower      = 1250.0
	PlayerGravity     = 950.0
)

func NewPlayer(game *GameScene, id int, posX, posY float64, facingRight bool) *Player {
	defaultAngle := -math.Pi / 4.0 // -45 deg
	name := "Archer 1"
	if !facingRight {
		defaultAngle = -math.Pi * 3.0 / 4.0 // -135 deg (aimed to the left)
		name = "Archer 2"
	}

	return &Player{
		game:          game,
		ID:            id,
		position:      Vector{X: posX, Y: posY},
		FacingRight:   facingRight,
		state:         ArcherIdle,
		currentFrame:  0,
		frameTicks:    0,
		ticksPerFrame: 7,
		AimAngle:      defaultAngle,
		AimPower:      DefaultPower,
		Health:             100,
		MaxHealth:          100,
		scale:              ArcherSpriteScale,
		Name:               name,
		ShootOutMultiplier: 1.0,
	}
}

// TriggerAttack begins the shooting animation.
func (p *Player) TriggerAttack() {
	if p.state == ArcherDie || p.state == ArcherHurt || p.isAirborne {
		return
	}
	if p.state == ArcherAttack {
		return
	}
	p.state = ArcherAttack
	p.currentFrame = 0
	p.frameTicks = 0
	p.ticksPerFrame = 4
	p.hasShotCurrentAnim = false
}

// TakeDamage reduces health and triggers hurt or death animation.
func (p *Player) TakeDamage(amount int) {
	if p.state == ArcherDie {
		return
	}
	p.Health -= amount

	if p.Health <= 0 {
		p.Health = 0
		p.state = ArcherDie
		p.currentFrame = 0
		p.frameTicks = 0
		p.ticksPerFrame = 6
	} else {
		p.state = ArcherHurt
		p.currentFrame = 0
		p.frameTicks = 0
		p.ticksPerFrame = 5
	}
}

// ApplyKnockback calculates how much the player shoots out / back (airborne jump and backflip)
// and dynamically changes the player's position based on arrow shooting power + arrow angle,
// scaled by the ShootOutFactor variable.
func (p *Player) ApplyKnockback(shootingPower, shootingAngle, impactVX float64) {
	// If shootingPower is missing/0, fallback to DefaultPower
	if shootingPower <= 0 {
		shootingPower = DefaultPower
	}

	// 1. Calculate normalized power ratio (0.0 at MinPower to 1.0 at MaxPower)
	powerRatio := (shootingPower - MinPower) / (MaxPower - MinPower)
	if powerRatio < 0 {
		powerRatio = 0
	}
	if powerRatio > 1.0 {
		powerRatio = 1.0
	}

	// 2. Resolve angle components
	cosA := math.Abs(math.Cos(shootingAngle))
	sinA := math.Abs(math.Sin(shootingAngle))

	// Combined scaling factor from ShootOutFactor variable and player multiplier
	scale := ShootOutFactor * p.ShootOutMultiplier

	// 3. Calculate target horizontal displacement distance based on shooting power and angle:
	// Low power (~500): ~80px displacement
	// Medium power (~1250): ~280px displacement
	// Max power (~1900): ~520px displacement (massive position change)
	targetDist := (70.0 + (powerRatio * 380.0) + (shootingPower/MaxPower)*(cosA*140.0)) * scale

	// 4. Calculate target jump height based on shooting power and angle:
	// Flatter shots have lower height; steeper plunge angles launch higher into the sky
	targetHeight := (110.0 + (powerRatio * 180.0) + (shootingPower/MaxPower)*(sinA*130.0)) * scale

	// 5. Compute exact initial vertical launch velocity to reach targetHeight under PlayerGravity
	p.launchVY = -math.Sqrt(2.0 * PlayerGravity * targetHeight)

	// 6. Compute exact flight air-time and required horizontal launch velocity to achieve targetDist
	airTime := 2.0 * math.Abs(p.launchVY) / PlayerGravity
	if airTime <= 0 {
		airTime = 1.0
	}
	horizSpeed := targetDist / airTime

	// 7. Backflip spin rotation speed proportional to shooting power
	rotSpeed := (7.0 + powerRatio*6.0) * scale

	if impactVX > 0 {
		// Arrow moving right -> throws player backward to the right
		p.launchVX = horizSpeed
		p.rotVelocity = rotSpeed
	} else {
		// Arrow moving left -> throws player backward to the left
		p.launchVX = -horizSpeed
		p.rotVelocity = -rotSpeed
	}

	p.isAirborne = true
	p.state = ArcherHurt
	p.currentFrame = 0
	p.frameTicks = 0
	p.ticksPerFrame = 5
}

// HitboxBounds returns the full axis-aligned bounding box of the archer,
// dynamically tracking the character wherever position changes.
func (p *Player) HitboxBounds() (minX, minY, maxX, maxY float64) {
	halfW := 52.0
	// Height extends from feet (position.Y) to head (position.Y - 145) with generous hit detection
	return p.position.X - halfW, p.position.Y - 145.0, p.position.X + halfW, p.position.Y + 8.0
}

// AdjustAngle adjusts aim angle by delta radians (clamping to the facing quadrant).
func (p *Player) AdjustAngle(delta float64) {
	p.AimAngle += delta
	if p.FacingRight {
		// Facing right: -80 deg to -10 deg
		minA := -80.0 * (math.Pi / 180.0)
		maxA := -10.0 * (math.Pi / 180.0)
		if p.AimAngle < minA {
			p.AimAngle = minA
		}
		if p.AimAngle > maxA {
			p.AimAngle = maxA
		}
	} else {
		// Facing left: -170 deg to -100 deg
		minA := -170.0 * (math.Pi / 180.0)
		maxA := -100.0 * (math.Pi / 180.0)
		if p.AimAngle < minA {
			p.AimAngle = minA
		}
		if p.AimAngle > maxA {
			p.AimAngle = maxA
		}
	}
}

// AdjustPower adjusts shot power.
func (p *Player) AdjustPower(delta float64) {
	p.AimPower += delta
	if p.AimPower < MinPower {
		p.AimPower = MinPower
	}
	if p.AimPower > MaxPower {
		p.AimPower = MaxPower
	}
}

// GetAngleDegrees returns the intuitive elevation angle (10° to 80°).
func (p *Player) GetAngleDegrees() int {
	deg := math.Abs(p.AimAngle) * 180.0 / math.Pi
	if !p.FacingRight {
		deg = 180.0 - deg
	}
	return int(math.Round(deg))
}

// BowPosition returns world coordinates where the arrow emerges from the bow.
func (p *Player) BowPosition() (float64, float64) {
	xOffset := 55.0
	if !p.FacingRight {
		xOffset = -55.0
	}
	return p.position.X + xOffset, p.position.Y - 50.0
}

func (p *Player) Update() {
	dt := 1.0 / 60.0

	if p.invulnerableTicks > 0 {
		p.invulnerableTicks--
	}

	// Airborne jump & backflip trajectory physics
	if p.isAirborne {
		p.launchVY += PlayerGravity * dt
		p.position.X += p.launchVX * dt
		p.position.Y += p.launchVY * dt
		p.rotation += p.rotVelocity * dt
		p.starAngle += 8.0 * dt

		// Clamp X to world boundaries
		if p.position.X < 80.0 {
			p.position.X = 80.0
			p.launchVX = 0
		}
		if p.position.X > float64(WorldWidth)-80.0 {
			p.position.X = float64(WorldWidth) - 80.0
			p.launchVX = 0
		}

		// Landing check on ground
		if p.position.Y >= DefaultGroundY {
			p.position.Y = DefaultGroundY
			p.launchVY = 0
			p.launchVX = 0
			p.isAirborne = false
			p.rotation = 0

			if p.Health <= 0 {
				p.state = ArcherDie
				p.currentFrame = len(p.getFrames(ArcherDie)) - 1
			} else {
				p.state = ArcherIdle
				p.currentFrame = 0
				p.ticksPerFrame = 7
			}
		}
	}

	p.frameTicks++
	if p.frameTicks >= p.ticksPerFrame {
		p.frameTicks = 0
		p.currentFrame++

		switch p.state {
		case ArcherIdle:
			frames := p.getFrames(ArcherIdle)
			if p.currentFrame >= len(frames) {
				p.currentFrame = 0
			}

		case ArcherAttack:
			// Spawn arrow at bow release frame (frame 6)
			if p.currentFrame == 6 && !p.hasShotCurrentAnim {
				p.shootArrow()
				p.hasShotCurrentAnim = true
			}
			frames := p.getFrames(ArcherAttack)
			if p.currentFrame >= len(frames) {
				p.state = ArcherIdle
				p.currentFrame = 0
				p.ticksPerFrame = 7
				p.hasShotCurrentAnim = false
			}

		case ArcherHurt:
			frames := p.getFrames(ArcherHurt)
			if p.currentFrame >= len(frames) {
				if !p.isAirborne {
					p.state = ArcherIdle
					p.currentFrame = 0
					p.ticksPerFrame = 7
				} else {
					p.currentFrame = len(frames) - 1
				}
			}

		case ArcherDie:
			frames := p.getFrames(ArcherDie)
			if p.currentFrame >= len(frames) {
				p.currentFrame = len(frames) - 1
			}
		}
	}
}

func (p *Player) shootArrow() {
	if p.game == nil {
		return
	}
	bowX, bowY := p.BowPosition()
	p.game.SpawnArrow(bowX, bowY, p.AimPower, p.AimAngle, p.ID)
}

func (p *Player) getFrames(state ArcherState) []*ebiten.Image {
	if p.ID == 1 {
		switch state {
		case ArcherIdle:
			return assets.ArcherIdle
		case ArcherAttack:
			return assets.ArcherAttack
		case ArcherHurt:
			return assets.ArcherHurt
		case ArcherDie:
			return assets.ArcherDie
		}
	} else {
		switch state {
		case ArcherIdle:
			return assets.Archer2Idle
		case ArcherAttack:
			return assets.Archer2Attack
		case ArcherHurt:
			return assets.Archer2Hurt
		case ArcherDie:
			return assets.Archer2Die
		}
	}
	return nil
}

func (p *Player) Draw(screen *ebiten.Image, camX, camY float64) {
	drawX := p.position.X - camX
	drawY := p.position.Y - camY

	// Skip if out of screen view
	if drawX < -180 || drawX > float64(ScreenWidth)+180 || drawY < -500 || drawY > float64(ScreenHeight)+180 {
		return
	}

	frames := p.getFrames(p.state)
	if len(frames) == 0 {
		return
	}
	idx := p.currentFrame
	if idx >= len(frames) {
		idx = len(frames) - 1
	}
	sprite := frames[idx]
	if sprite == nil {
		return
	}

	// Shadow on ground (shrinks when player jumps high)
	if p.state != ArcherDie {
		heightAboveGround := DefaultGroundY - p.position.Y
		shadowScale := 1.0 - heightAboveGround/300.0
		if shadowScale < 0.25 {
			shadowScale = 0.25
		}
		groundDrawY := DefaultGroundY - camY
		vector.DrawFilledCircle(
			screen,
			float32(drawX),
			float32(groundDrawY+2),
			float32(34.0*shadowScale),
			color.RGBA{0, 0, 0, uint8(75.0 * shadowScale)},
			true,
		)
	}

	op := &ebiten.DrawImageOptions{}
	op.GeoM.Translate(-1000, -825)
	if p.FacingRight {
		op.GeoM.Scale(p.scale, p.scale)
	} else {
		op.GeoM.Scale(-p.scale, p.scale)
	}

	// Center-of-mass backflip rotation when launched into the air
	if p.rotation != 0 {
		op.GeoM.Translate(0, 65)
		op.GeoM.Rotate(p.rotation)
		op.GeoM.Translate(0, -65)
	}

	op.GeoM.Translate(drawX, drawY)

	if p.state == ArcherHurt {
		op.ColorScale.Scale(1.5, 0.4, 0.4, 1.0)
	}

	screen.DrawImage(sprite, op)

	// Draw golden dizzy stars orbiting the tumbling/airborne archer (Bowmasters style)
	if p.isAirborne || p.state == ArcherHurt {
		p.drawDizzyStars(screen, float32(drawX), float32(drawY-65))
	}

	// Draw Aim Guide Trajectory when active and aiming
	if p.game != nil && p.game.ActivePlayer() == p && p.state == ArcherIdle && !p.isAirborne {
		p.drawAimGuide(screen, camX, camY)
	}
}

// drawDizzyStars renders 5 rotating golden stars around the character as seen in Bowmasters.
func (p *Player) drawDizzyStars(screen *ebiten.Image, cx, cy float32) {
	numStars := 5
	orbitRadius := float32(48.0)
	starColor := color.RGBA{R: 255, G: 220, B: 40, A: 255}

	for i := 0; i < numStars; i++ {
		angle := p.starAngle + float64(i)*(2.0*math.Pi/float64(numStars))
		sx := cx + float32(math.Cos(angle))*orbitRadius
		sy := cy + float32(math.Sin(angle))*(orbitRadius*0.5) // ellipse orbit

		drawStar(screen, sx, sy, 7.5, starColor)
	}
}

// drawStar renders a crisp 5-point star polygon.
func drawStar(screen *ebiten.Image, cx, cy, r float32, c color.RGBA) {
	points := make([][2]float32, 10)
	for i := 0; i < 10; i++ {
		angle := float64(i)*math.Pi/5.0 - math.Pi/2.0
		rad := r
		if i%2 == 1 {
			rad = r * 0.42
		}
		points[i] = [2]float32{
			cx + float32(math.Cos(angle))*rad,
			cy + float32(math.Sin(angle))*rad,
		}
	}
	for i := 0; i < 10; i++ {
		p1 := points[i]
		p2 := points[(i+1)%10]
		vector.StrokeLine(screen, p1[0], p1[1], p2[0], p2[1], 2.0, c, true)
	}
	vector.DrawFilledCircle(screen, cx, cy, r*0.35, c, true)
}

// drawAimGuide simulates the first few steps of the arrow physics to show an authentic trajectory guide.
func (p *Player) drawAimGuide(screen *ebiten.Image, camX, camY float64) {
	simX, simY := p.BowPosition()
	simVX := p.AimPower * math.Cos(p.AimAngle)
	simVY := p.AimPower * math.Sin(p.AimAngle)
	dt := 1.0 / 60.0

	guideColor := color.RGBA{R: 255, G: 215, B: 50, A: 220}
	if p.ID == 2 {
		guideColor = color.RGBA{R: 70, G: 190, B: 255, A: 220}
	}

	for step := 0; step < 26; step++ {
		speed := math.Hypot(simVX, simVY)
		ax := -ArrowDragCoeff * speed * simVX
		ay := ArrowGravity - (ArrowDragCoeff * speed * simVY)
		simVX += ax * dt
		simVY += ay * dt
		simX += simVX * dt
		simY += simVY * dt

		if step%2 == 0 {
			sx := float32(simX - camX)
			sy := float32(simY - camY)
			alpha := uint8(230 - step*7)
			c := guideColor
			c.A = alpha
			vector.DrawFilledCircle(screen, sx, sy, float32(3.5-float64(step)*0.08), c, true)
		}
	}
}

// CenterPosition returns the hitbox center in world coordinates.
func (p *Player) CenterPosition() (float64, float64) {
	return p.position.X, p.position.Y - 65
}

// HitboxRadius returns collision radius for archer.
func (p *Player) HitboxRadius() float64 {
	return 48.0
}

// IsDead returns true if archer health reached 0.
func (p *Player) IsDead() bool {
	return p.state == ArcherDie || p.Health <= 0
}

// IsAirborne returns true while the character is tumbling in the air.
func (p *Player) IsAirborne() bool {
	return p.isAirborne
}
