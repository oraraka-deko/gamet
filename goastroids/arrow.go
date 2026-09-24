package goastroids

import (
	"fmt"
	"image/color"
	"math"

	"gamet/assets"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/text/v2"
	"github.com/hajimehoshi/ebiten/v2/vector"
)

const (
	ArrowGravity   = 450.0  // Realistic gravity
	ArrowDragCoeff = 0.0003 // Tuned drag
	DefaultGroundY = 470.0  // Ground level in world pixels
)

type ArrowState int

const (
	ArrowFlying ArrowState = iota
	ArrowStuck
	ArrowHit
)

type Arrow struct {
	X             float64
	Y             float64
	PrevX         float64
	PrevY         float64
	VX            float64
	VY            float64
	Angle         float64 // Radians
	Length        float64
	State         ArrowState
	Active        bool
	Trail         [][2]float64
	Shooter       int     // 1 for Player 1, 2 for Player 2
	ShootingPower float64 // Original launch power
	ShootingAngle float64 // Original launch angle
}

// NewArrow creates a new ballistic arrow launched from (startX, startY) at initial speed along angleRad.
func NewArrow(startX, startY, speed, angleRad float64, shooter int) *Arrow {
	return &Arrow{
		X:             startX,
		Y:             startY,
		PrevX:         startX,
		PrevY:         startY,
		VX:            speed * math.Cos(angleRad),
		VY:            speed * math.Sin(angleRad),
		Angle:         angleRad,
		Length:        34.0,
		State:         ArrowFlying,
		Active:        true,
		Trail:         make([][2]float64, 0, 100),
		Shooter:       shooter,
		ShootingPower: speed,
		ShootingAngle: angleRad,
	}
}

// Update performs semi-implicit Euler integration with aerodynamic drag and weather-vaning pitch alignment.
func (a *Arrow) Update(dt float64, groundY float64) {
	if a.State != ArrowFlying {
		return
	}

	a.PrevX = a.X
	a.PrevY = a.Y

	// 1. Current speed
	speed := math.Hypot(a.VX, a.VY)

	// 2. Aerodynamic drag opposing velocity direction
	ax := -ArrowDragCoeff * speed * a.VX
	ay := ArrowGravity - (ArrowDragCoeff * speed * a.VY)

	// 3. Semi-implicit Euler integration
	a.VX += ax * dt
	a.VY += ay * dt
	a.X += a.VX * dt
	a.Y += a.VY * dt

	// 4. Aerodynamic alignment (weather-vaning) with torque smoothing
	targetAngle := math.Atan2(a.VY, a.VX)
	diff := targetAngle - a.Angle
	for diff > math.Pi {
		diff -= 2 * math.Pi
	}
	for diff < -math.Pi {
		diff += 2 * math.Pi
	}
	a.Angle += diff * 0.22

	// 5. Append trajectory trail
	a.Trail = append(a.Trail, [2]float64{a.X, a.Y})
	if len(a.Trail) > 75 {
		a.Trail = a.Trail[1:]
	}

	// 6. Ground penetration check: tip embeds into the earth even if outside normal screen borders
	halfLen := a.Length / 2.0
	tipY := a.Y + math.Sin(a.Angle)*halfLen
	tipX := a.X + math.Cos(a.Angle)*halfLen

	if tipY >= groundY {
		// Embed arrow tip into terrain and freeze motion
		a.Y = groundY - math.Sin(a.Angle)*halfLen
		a.X = tipX - math.Cos(a.Angle)*halfLen
		a.VX = 0
		a.VY = 0
		a.State = ArrowStuck
		a.Trail = nil // Reset trajectory line when flight completes
	}

	// Broad bounds check: allows arrows to travel far outside the scene without being abruptly killed
	if a.X < -3000 || a.X > float64(WorldWidth)+3000 || a.Y > groundY+500 {
		a.Active = false
	}
}

// TipPosition returns the exact world coordinates of the arrowhead tip.
func (a *Arrow) TipPosition() (float64, float64) {
	halfLen := a.Length / 2.0
	return a.X + math.Cos(a.Angle)*halfLen, a.Y + math.Sin(a.Angle)*halfLen
}

// PrevTipPosition returns the world coordinates of the arrowhead tip from the previous frame.
func (a *Arrow) PrevTipPosition() (float64, float64) {
	halfLen := a.Length / 2.0
	return a.PrevX + math.Cos(a.Angle)*halfLen, a.PrevY + math.Sin(a.Angle)*halfLen
}

// TailPosition returns the exact world coordinates of the arrow tail.
func (a *Arrow) TailPosition() (float64, float64) {
	halfLen := a.Length / 2.0
	return a.X - math.Cos(a.Angle)*halfLen, a.Y - math.Sin(a.Angle)*halfLen
}

// CollidesWithPlayer uses Continuous Collision Detection (CCD) to test whether
// the arrow's flight path or body intersects the player's full bounding area.
func (a *Arrow) CollidesWithPlayer(p *Player) bool {
	if a.State != ArrowFlying || p == nil {
		return false
	}

	minX, minY, maxX, maxY := p.HitboxBounds()

	// 1. Check if current tip is inside player box
	tipX, tipY := a.TipPosition()
	if tipX >= minX && tipX <= maxX && tipY >= minY && tipY <= maxY {
		return true
	}

	// 2. Check if current tail is inside player box (body penetration)
	tailX, tailY := a.TailPosition()
	if tailX >= minX && tailX <= maxX && tailY >= minY && tailY <= maxY {
		return true
	}

	// 3. Continuous Collision Detection (CCD): Check segment between previous tip and current tip
	prevTipX, prevTipY := a.PrevTipPosition()
	if segmentIntersectsAABB(prevTipX, prevTipY, tipX, tipY, minX, minY, maxX, maxY) {
		return true
	}

	// 4. Check arrow shaft segment (tail to tip)
	return segmentIntersectsAABB(tailX, tailY, tipX, tipY, minX, minY, maxX, maxY)
}

// segmentIntersectsAABB uses the Liang-Barsky parametric algorithm to test line-segment vs box intersection.
func segmentIntersectsAABB(x1, y1, x2, y2, minX, minY, maxX, maxY float64) bool {
	if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) ||
		(x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) {
		return true
	}

	dx := x2 - x1
	dy := y2 - y1

	p := [4]float64{-dx, dx, -dy, dy}
	q := [4]float64{x1 - minX, maxX - x1, y1 - minY, maxY - y1}

	u1 := 0.0
	u2 := 1.0

	for i := 0; i < 4; i++ {
		if p[i] == 0 {
			if q[i] < 0 {
				return false
			}
		} else {
			t := q[i] / p[i]
			if p[i] < 0 {
				if t > u1 {
					u1 = t
				}
			} else {
				if t < u2 {
					u2 = t
				}
			}
			if u1 > u2 {
				return false
			}
		}
	}
	return true
}

// Draw renders the arrow sprite, trajectory arc, and off-screen sky marker if high in the sky.
func (a *Arrow) Draw(screen *ebiten.Image, camX, camY float64) {
	// 1. Draw trajectory arc ONLY while arrow is actively flying; resets completely after each shoot
	if a.State == ArrowFlying {
		trailLen := len(a.Trail)
		for i := 1; i < trailLen; i++ {
			p1 := a.Trail[i-1]
			p2 := a.Trail[i]
			alpha := uint8(float64(i) / float64(trailLen) * 150.0)
			trailColor := color.RGBA{R: 245, G: 190, B: 70, A: alpha}
			if a.Shooter == 2 {
				trailColor = color.RGBA{R: 80, G: 195, B: 255, A: alpha}
			}
			vector.StrokeLine(
				screen,
				float32(p1[0]-camX), float32(p1[1]-camY),
				float32(p2[0]-camX), float32(p2[1]-camY),
				2.0,
				trailColor,
				true,
			)
		}
	}

	drawX := a.X - camX
	drawY := a.Y - camY

	// If the arrow is soaring high above the visible screen, draw an off-screen sky indicator
	if a.State == ArrowFlying && drawY < 75 && drawX >= 20 && drawX <= float64(ScreenWidth)-20 {
		a.drawSkyIndicator(screen, float32(drawX), float64(drawY))
	}

	// Draw Arrow Sprite if in screen bounds (with margin)
	if drawX < -80 || drawX > float64(ScreenWidth)+80 || drawY < -80 || drawY > float64(ScreenHeight)+80 {
		return
	}

	if assets.ArrowSprite != nil {
		op := &ebiten.DrawImageOptions{}
		op.GeoM.Translate(-128, -128)
		op.GeoM.Rotate(a.Angle + math.Pi/4)
		scale := 0.22
		op.GeoM.Scale(scale, scale)
		op.GeoM.Translate(drawX, drawY)

		screen.DrawImage(assets.ArrowSprite, op)
	}
}

// drawSkyIndicator renders a sleek HUD indicator when arrow is flying high above the screen.
func (a *Arrow) drawSkyIndicator(screen *ebiten.Image, sx float32, drawY float64) {
	sy := float32(88)
	indicatorColor := color.RGBA{R: 255, G: 215, B: 60, A: 240}
	if a.Shooter == 2 {
		indicatorColor = color.RGBA{R: 70, G: 200, B: 255, A: 240}
	}

	// Chevron indicator pointing in vertical direction of flight
	if a.VY < 0 {
		// Ascending (pointing up)
		vector.StrokeLine(screen, sx-7, sy+6, sx, sy, 2.5, indicatorColor, true)
		vector.StrokeLine(screen, sx+7, sy+6, sx, sy, 2.5, indicatorColor, true)
	} else {
		// Descending (pointing down)
		vector.StrokeLine(screen, sx-7, sy-6, sx, sy, 2.5, indicatorColor, true)
		vector.StrokeLine(screen, sx+7, sy-6, sx, sy, 2.5, indicatorColor, true)
	}

	// Height altitude readout
	alt := int(math.Abs(drawY))
	altText := fmt.Sprintf("%dm", alt)
	if assets.TitleFont != nil {
		op := &text.DrawOptions{}
		op.LayoutOptions.PrimaryAlign = text.AlignCenter
		op.ColorScale.ScaleWithColor(indicatorColor)
		op.GeoM.Translate(float64(sx), float64(sy+8))
		text.Draw(screen, altText, &text.GoTextFace{
			Source: assets.TitleFont,
			Size:   11,
		}, op)
	}
}
