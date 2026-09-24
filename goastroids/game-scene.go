package goastroids

import (
	"time"

	"github.com/hajimehoshi/ebiten/v2"
)

const(
MeteorBaseVolacity=0.25
MeteorSpawnTime=100*time.Millisecond
MeteorSpeedUpAmount=0.1
MeteorSpeedUpTime=1000*time.Millisecond
)


type GameScene struct {
	player *Player
	baseVolacity float64
	meteorCount  int
	meteorSpawnTimer *Timer
	meteor map[int]*Meteor
	meteorForLevel int
	volacityTimer *Timer
}


func NewGameScene() *GameScene {
	g:= &GameScene{
		meteorSpawnTimer: NewTimer(MeteorSpawnTime),
		baseVolacity: MeteorBaseVolacity,
		volacityTimer: NewTimer(MeteorSpeedUpTime),
		meteor: make(map[int]*Meteor),
		meteorCount: 0,
		meteorForLevel: 2,
	}
	g.player=NewPlayer(g)
	return g
}

func (g *GameScene) Update(state *State)error{
g.player.Update()
g.spawnMeteors()
for _,m:= range g.meteor{
	m.Update()
}
g.speedUpMeteors()
return nil
} 

func (g *GameScene) Draw(screen *ebiten.Image){
	g.player.Draw(screen)

	for _,m:= range g.meteor{
		m.Draw(screen)
	}
}

func (g *GameScene) Layout(outsideWidth, outsideHeight int) (screenWidth, screenHeight int) {
	return outsideWidth, outsideHeight
}


func(g*GameScene)spawnMeteors(){
	g.meteorSpawnTimer.Update()
	if g.meteorSpawnTimer.IsReady(){
		g.meteorSpawnTimer.Reset()
		if len(g.meteor)< g.meteorForLevel&& g.meteorCount<g.meteorForLevel{
m := NewMeteor(g.baseVolacity,g,len(g.meteor)-1)
g.meteorCount++
g.meteor[g.meteorCount]=m
		}
	}
}

func(g*GameScene)speedUpMeteors(){

	g.volacityTimer.Update()
	if g.volacityTimer.IsReady(){
		g.volacityTimer.Reset()
		g.baseVolacity+=MeteorSpeedUpAmount
	}
}