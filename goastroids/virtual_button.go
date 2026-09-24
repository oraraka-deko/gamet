package goastroids

import (
	"image/color"
	"math"

	"gamet/assets"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/text/v2"
	"github.com/hajimehoshi/ebiten/v2/vector"
)

// VirtualButton is an on-screen interactive button supporting mouse, touch, and keyboard.
type VirtualButton struct {
	X            float32
	Y            float32
	Radius       float32
	Label        string
	SubLabel     string
	HotKey       ebiten.Key
	
	isHovered    bool
	isPressed    bool
	justPressed  bool
	justReleased bool
	
	// Visual animation states
	pressScale   float32
	rippleRadius float32
	rippleAlpha  float32
	
	// Theme colors
	BaseColor    color.RGBA
	HoverColor   color.RGBA
	ActiveColor  color.RGBA
	BorderColor  color.RGBA
	TextColor    color.RGBA
}

// NewVirtualButton creates a virtual button at (x, y) with a given radius and label.
func NewVirtualButton(x, y, radius float32, label, subLabel string, hotKey ebiten.Key) *VirtualButton {
	return &VirtualButton{
		X:          x,
		Y:          y,
		Radius:     radius,
		Label:      label,
		SubLabel:   subLabel,
		HotKey:     hotKey,
		pressScale: 1.0,
		BaseColor:  color.RGBA{R: 28, G: 32, B: 48, A: 210},
		HoverColor: color.RGBA{R: 44, G: 54, B: 82, A: 240},
		ActiveColor: color.RGBA{R: 220, G: 90, B: 30, A: 245},
		BorderColor: color.RGBA{R: 255, G: 180, B: 50, A: 230},
		TextColor:   color.RGBA{R: 255, G: 255, B: 255, A: 255},
	}
}

// Update handles mouse, touch, and keyboard input for the button.
func (b *VirtualButton) Update() {
	wasPressed := b.isPressed
	b.isPressed = false
	b.isHovered = false

	// Check mouse input
	mx, my := ebiten.CursorPosition()
	distSq := (float32(mx)-b.X)*(float32(mx)-b.X) + (float32(my)-b.Y)*(float32(my)-b.Y)
	mouseInside := distSq <= b.Radius*b.Radius

	if mouseInside {
		b.isHovered = true
		if ebiten.IsMouseButtonPressed(ebiten.MouseButtonLeft) {
			b.isPressed = true
		}
	}

	// Check touches (mobile / touchscreen support)
	touchIDs := ebiten.AppendTouchIDs(nil)
	for _, id := range touchIDs {
		tx, ty := ebiten.TouchPosition(id)
		tdistSq := (float32(tx)-b.X)*(float32(tx)-b.X) + (float32(ty)-b.Y)*(float32(ty)-b.Y)
		if tdistSq <= (b.Radius*1.2)*(b.Radius*1.2) {
			b.isPressed = true
			b.isHovered = true
			break
		}
	}

	// Keyboard shortcut support (e.g. Spacebar or Enter)
	if b.HotKey != 0 && ebiten.IsKeyPressed(b.HotKey) {
		b.isPressed = true
	}

	b.justPressed = b.isPressed && !wasPressed
	b.justReleased = !b.isPressed && wasPressed

	// Animation spring physics for button press
	targetScale := float32(1.0)
	if b.isPressed {
		targetScale = 0.88
	} else if b.isHovered {
		targetScale = 1.05
	}
	b.pressScale += (targetScale - b.pressScale) * 0.25

	// Trigger ripple effect on press
	if b.justPressed {
		b.rippleRadius = b.Radius * 0.8
		b.rippleAlpha = 1.0
	}

	// Expand and fade ripple
	if b.rippleAlpha > 0 {
		b.rippleRadius += 2.0
		b.rippleAlpha -= 0.07
		if b.rippleAlpha < 0 {
			b.rippleAlpha = 0
		}
	}
}

// IsPressed returns true while the button is held down.
func (b *VirtualButton) IsPressed() bool {
	return b.isPressed
}

// IsJustPressed returns true only on the initial frame of press.
func (b *VirtualButton) IsJustPressed() bool {
	return b.justPressed
}

// IsJustReleased returns true on the frame when the button was released.
func (b *VirtualButton) IsJustReleased() bool {
	return b.justReleased
}

// Draw renders the virtual button with glow, inner fill, border, label, and ripple effect.
func (b *VirtualButton) Draw(screen *ebiten.Image) {
	effectiveR := b.Radius * b.pressScale

	// Outer ambient glow
	glowColor := b.BorderColor
	glowColor.A = 35
	if b.isPressed {
		glowColor = color.RGBA{R: 255, G: 120, B: 40, A: 80}
	}
	vector.DrawFilledCircle(screen, b.X, b.Y, effectiveR+10, glowColor, true)

	// Expanding ripple ring on press
	if b.rippleAlpha > 0 {
		rColor := b.ActiveColor
		rColor.A = uint8(float32(rColor.A) * b.rippleAlpha)
		vector.StrokeCircle(screen, b.X, b.Y, b.rippleRadius, 2.5, rColor, true)
	}

	// Main button background fill
	fillColor := b.BaseColor
	if b.isPressed {
		fillColor = b.ActiveColor
	} else if b.isHovered {
		fillColor = b.HoverColor
	}
	vector.DrawFilledCircle(screen, b.X, b.Y, effectiveR, fillColor, true)

	// Inner gloss highlight arc (top half)
	highlightColor := color.RGBA{R: 255, G: 255, B: 255, A: 40}
	if b.isPressed {
		highlightColor = color.RGBA{R: 255, G: 255, B: 255, A: 80}
	}
	vector.DrawFilledCircle(screen, b.X, b.Y-effectiveR*0.25, effectiveR*0.65, highlightColor, true)

	// Outer decorative ring
	borderC := b.BorderColor
	if b.isPressed {
		borderC = color.RGBA{R: 255, G: 230, B: 150, A: 255}
	}
	vector.StrokeCircle(screen, b.X, b.Y, effectiveR, 2.8, borderC, true)
	vector.StrokeCircle(screen, b.X, b.Y, effectiveR-4, 1.0, color.RGBA{R: 255, G: 255, B: 255, A: 60}, true)

	// Crosshair / bow icon ticks
	tickLen := effectiveR * 0.18
	tickColor := color.RGBA{R: 255, G: 255, B: 255, A: 120}
	if b.isPressed {
		tickColor = color.RGBA{R: 255, G: 255, B: 200, A: 220}
	}
	vector.StrokeLine(screen, b.X-effectiveR, b.Y, b.X-effectiveR+tickLen, b.Y, 2.0, tickColor, true)
	vector.StrokeLine(screen, b.X+effectiveR-tickLen, b.Y, b.X+effectiveR, b.Y, 2.0, tickColor, true)
	vector.StrokeLine(screen, b.X, b.Y-effectiveR, b.X, b.Y-effectiveR+tickLen, 2.0, tickColor, true)
	vector.StrokeLine(screen, b.X, b.Y+effectiveR-tickLen, b.X, b.Y+effectiveR, 2.0, tickColor, true)

	// Draw Button Label Text
	if b.Label != "" && assets.TitleFont != nil {
		fontSize := float64(effectiveR * 0.38)
		if fontSize < 11 {
			fontSize = 11
		}
		
		textYOffset := float64(b.Y) - fontSize*0.6
		if b.SubLabel != "" {
			textYOffset -= fontSize * 0.35
		}

		op := &text.DrawOptions{}
		op.LayoutOptions.PrimaryAlign = text.AlignCenter
		textColor := b.TextColor
		if b.isPressed {
			textColor = color.RGBA{R: 255, G: 255, B: 240, A: 255}
		}
		op.ColorScale.ScaleWithColor(textColor)
		op.GeoM.Translate(float64(b.X), textYOffset)

		text.Draw(screen, b.Label, &text.GoTextFace{
			Source: assets.TitleFont,
			Size:   fontSize,
		}, op)

		// Draw sub-label (e.g. "[SPACE]" hotkey hint)
		if b.SubLabel != "" {
			subSize := fontSize * 0.65
			subOp := &text.DrawOptions{}
			subOp.LayoutOptions.PrimaryAlign = text.AlignCenter
			subColor := color.RGBA{R: 210, G: 225, B: 250, A: 190}
			subOp.ColorScale.ScaleWithColor(subColor)
			subOp.GeoM.Translate(float64(b.X), textYOffset+fontSize*1.1)

			text.Draw(screen, b.SubLabel, &text.GoTextFace{
				Source: assets.TitleFont,
				Size:   subSize,
			}, subOp)
		}
	}
}

// DistanceTo returns the distance from a point to the button center.
func (b *VirtualButton) DistanceTo(px, py float32) float32 {
	dx := px - b.X
	dy := py - b.Y
	return float32(math.Sqrt(float64(dx*dx + dy*dy)))
}
