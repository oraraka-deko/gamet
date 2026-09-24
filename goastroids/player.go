package goastroids

import (
	"fmt"
	"gamet/assets"
	"math"
	"github.com/hajimehoshi/ebiten/v2"
)

const(
     maxAcceleration =8.0
	rotationPerSecond = math.Pi
	ScreenWidth  = 800
	ScreenHeight = 600
)
var curAcceleration float64 


type Player struct {
game *GameScene
	sprite *ebiten.Image
	rotation float64
position Vector
playerVlocity  float64


}

func NewPlayer(game *GameScene) *Player {
	sprite := assets.PlayerSprite

bounds := sprite.Bounds()
halfw := float64(bounds.Dx()) / 2
halfh := float64(bounds.Dy()) / 2
	pose := Vector{X: ScreenWidth/2 - halfw, Y: ScreenHeight/2 - halfh}

	p :=&Player{
		sprite: sprite,
		game: game,
		position: pose,
	}
	return p
}

func (p *Player)Draw (screen *ebiten.Image){
bounds := p.sprite.Bounds()
halfw := float64(bounds.Dx()) /2
halfh := float64(bounds.Dy()) /2

op := &ebiten.DrawImageOptions{}
op.GeoM.Translate(-halfw, -halfh)
op.GeoM.Rotate(p.rotation)
op.GeoM.Translate(halfw,halfh)
op.GeoM.Translate(p.position.X,p.position.Y)

screen.DrawImage(p.sprite, op)
}



func (p *Player) Update(){
 speed := rotationPerSecond / float64(ebiten.TPS())

 if ebiten.IsKeyPressed(ebiten.KeyLeft){
fmt.Println("left pressed ")
p.rotation -= speed

 }
  if ebiten.IsKeyPressed(ebiten.KeyRight){
fmt.Println("right pressed ")
p.rotation += speed
  }
p.Accelerate()
}
func (p *Player) Accelerate(){
			
		p.keepOnScreen()

	if ebiten.IsKeyPressed(ebiten.KeyUp){
		if curAcceleration < maxAcceleration{
			curAcceleration = p.playerVlocity+0.1
		}

		if curAcceleration >= 8{
			curAcceleration = 8
		}
	
	p.playerVlocity = curAcceleration
dy := math.Cos(p.rotation) * -curAcceleration
dx := math.Sin(p.rotation) * curAcceleration
p.position.X += dx
p.position.Y += dy
	}
	if ebiten.IsKeyPressed(ebiten.KeyDown){
		if curAcceleration < maxAcceleration{
			curAcceleration = p.playerVlocity+0.1
		}

		if curAcceleration >= 8{
			curAcceleration = 8
		}
	
	p.playerVlocity = curAcceleration
dy := math.Cos(p.rotation) * -curAcceleration
dx := math.Sin(p.rotation) * curAcceleration
p.position.X -= dx
p.position.Y -= dy
	}
}

func (p *Player) keepOnScreen() {
if p.position.X >= float64(ScreenWidth) {
	p.position.X= 0
}
if p.position.X < 0 {
	p.position.X = float64(ScreenWidth)
}
if p.position.Y >= float64(ScreenHeight) {
	p.position.Y = 0
	
}
if p.position.Y < 0 {
	p.position.Y = float64(ScreenHeight)
}
}
