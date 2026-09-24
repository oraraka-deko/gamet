package goastroids

import (
	"gamet/assets"

	"github.com/hajimehoshi/ebiten/v2"
)

type Explosion struct {
	X      float64
	Y      float64
	ticks  int
	max    int
	Active bool
}

func NewExplosion(x, y float64) *Explosion {
	return &Explosion{
		X:      x,
		Y:      y,
		ticks:  0,
		max:    18,
		Active: true,
	}
}

func (e *Explosion) Update() {
	if !e.Active {
		return
	}
	e.ticks++
	if e.ticks >= e.max {
		e.Active = false
	}
}

func (e *Explosion) Draw(screen *ebiten.Image, camX, camY float64) {
	if !e.Active || assets.ExplosionSprite == nil {
		return
	}

	drawX := e.X - camX
	drawY := e.Y - camY
	if drawX < -80 || drawX > float64(ScreenWidth)+80 {
		return
	}

	progress := float32(e.ticks) / float32(e.max)
	alpha := 1.0 - progress
	scale := 0.4 + float64(progress)*0.5

	b := assets.ExplosionSprite.Bounds()
	halfW := float64(b.Dx()) / 2.0
	halfH := float64(b.Dy()) / 2.0

	op := &ebiten.DrawImageOptions{}
	op.GeoM.Translate(-halfW, -halfH)
	op.GeoM.Scale(scale, scale)
	op.GeoM.Translate(drawX, drawY)
	op.ColorScale.ScaleAlpha(alpha)

	screen.DrawImage(assets.ExplosionSprite, op)
}
