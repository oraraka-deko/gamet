package main

import (
	"gamet/goastroids"

	"github.com/hajimehoshi/ebiten/v2"
)


func main(){

ebiten.SetWindowSize(goastroids.ScreenWidth, goastroids.ScreenHeight)
ebiten.SetWindowTitle("Game")
err := ebiten.RunGame(&goastroids.Game{})
if err!=nil{
	panic(err)
}

}