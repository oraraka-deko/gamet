package goastroids

import (
	"gamet/assets"
	"math"
	"math/rand"

	"github.com/hajimehoshi/ebiten/v2"
)

const (
	rotationSpeedMin              = -0.02
	rotationSpeedMax              = 0.02
	numberOfSmallMeteorsFromLarge = 4
)

type Meteor struct {
	game          *GameScene
	positon       Vector
	rotation      float64
	movement      Vector
	angle         float64
	rotationSpeed float64
	sprite        *ebiten.Image
}
func NewMeteor(baseVolacity float64, g *GameScene, index int) *Meteor{
target := Vector{
	X: ScreenWidth/2,
	Y: ScreenHeight/2,

}
  angle := rand.Float64()*2*math.Pi
r:= ScreenWidth/2.0 + 500

pos := Vector{
	X: target.X + math.Cos(angle)*r,
Y: target.Y + math.Sin(angle)*r,

}
volac := baseVolacity + rand.Float64()*1.5
direction := Vector{
	X: target.X -pos.X,
	Y: target.Y - pos.Y,
}

normalizeDirection := direction.Normalize()
movement := Vector{
	X: normalizeDirection.X *volac,
	Y: normalizeDirection.Y *volac,
}
sprite:= assets.MeteoresSprites[rand.Intn(len(assets.MeteoresSprites))]
m := &Meteor{
	game:g,
	movement: movement,
	sprite: sprite,
	positon: pos,
	rotationSpeed: rotationSpeedMin + rand.Float64()*(rotationSpeedMax-rotationSpeedMin),
	angle: angle,
}
return  m
}



func(m *Meteor)Update(){
	dx := m.movement.X
dy := m.movement.Y
m.positon.X += dx
m.positon.Y += dy
m.rotation += m.rotationSpeed
m.keepOnScreen()
}

func(m* Meteor)Draw(screen *ebiten.Image){
	bounds := m.sprite.Bounds()
	halfW:= float64(bounds.Dx())/2
	halfh:= float64(bounds.Dy())/2
op:= &ebiten.DrawImageOptions{}
op.GeoM.Translate(-halfW,-halfh)
op.GeoM.Rotate(m.rotation)
op.GeoM.Translate(halfW,halfh)
op.GeoM.Translate(m.positon.X,m.positon.Y)
screen.DrawImage(m.sprite,op)


}


func(m*Meteor)keepOnScreen(){
	if m.positon.X >= float64(ScreenWidth){
		m.positon.X =0

	}
	if m.positon.X <0 {
		m.positon.X=float64(ScreenWidth)

	}
	if m.positon.Y >= float64(ScreenHeight){
		m.positon.Y = 0

	}
	if m.positon.Y < 0 {
		m.positon.Y = float64(ScreenHeight)
	}

}