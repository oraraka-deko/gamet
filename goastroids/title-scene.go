package goastroids

import (
	"gamet/assets"
	"image/color"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/inpututil"
	"github.com/hajimehoshi/ebiten/v2/text/v2"
)
type TitleScene struct {
	meteor map[int]*Meteor
	meteorCount int
}

func (t *TitleScene) Draw(screen *ebiten.Image) {
	textToDraw := "1 coin 1 play"
	op:= &text.DrawOptions{LayoutOptions:text.LayoutOptions{
		PrimaryAlign: text.AlignCenter,
	} }
	op.ColorScale.ScaleWithColor(color.White)
	op.GeoM.Translate(float64(ScreenWidth)/2, ScreenHeight-80)
	text.Draw(screen,textToDraw,&text.GoTextFace{
		Source: assets.TitleFont,
		Size: 48,
	},op)
	for _, m := range t.meteor{
		m.Draw(screen)
	}
}
func(t *TitleScene) Update(state *State) error{
if	inpututil.IsKeyJustPressed(ebiten.KeySpace){
	state.SceneManager.GoToScene(NewGameScene())
	return nil
}
if len(t.meteor)<10{
	m := NewMeteor(0.25,&GameScene{},len(t.meteor)-1)
	t.meteorCount++
	t.meteor[t.meteorCount]=m
}
for _,m :=range t.meteor{
	m.Update()
}
return nil
}

