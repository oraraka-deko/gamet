package goastroids

import (
	"image/color"

	"gamet/assets"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/inpututil"
	"github.com/hajimehoshi/ebiten/v2/text/v2"
	"github.com/hajimehoshi/ebiten/v2/vector"
)

type TitleScene struct {
	startButton *VirtualButton
	idleFrame   int
	idleTicks   int
}

func NewTitleScene() *TitleScene {
	return &TitleScene{
		startButton: NewVirtualButton(float32(ScreenWidth)/2, float32(ScreenHeight)-110, 52, "BATTLE", "[SPACE]", ebiten.KeySpace),
	}
}

func (t *TitleScene) Update(state *State) error {
	if t.startButton == nil {
		t.startButton = NewVirtualButton(float32(ScreenWidth)/2, float32(ScreenHeight)-110, 52, "BATTLE", "[SPACE]", ebiten.KeySpace)
	}

	t.startButton.Update()

	t.idleTicks++
	if t.idleTicks >= 8 {
		t.idleTicks = 0
		t.idleFrame++
		if t.idleFrame >= len(assets.ArcherIdle) {
			t.idleFrame = 0
		}
	}

	if t.startButton.IsJustPressed() || inpututil.IsKeyJustPressed(ebiten.KeySpace) || inpututil.IsKeyJustPressed(ebiten.KeyEnter) {
		state.SceneManager.GoToScene(NewGameScene())
		return nil
	}

	return nil
}

func (t *TitleScene) Draw(screen *ebiten.Image) {
	// Sky gradient
	vector.DrawFilledRect(screen, 0, 0, ScreenWidth, ScreenHeight, color.RGBA{16, 22, 38, 255}, false)

	// Ground plane
	groundY := float32(DefaultGroundY + 2)
	vector.DrawFilledRect(screen, 0, groundY, ScreenWidth, ScreenHeight-groundY, color.RGBA{34, 44, 64, 255}, false)
	vector.StrokeLine(screen, 0, groundY, ScreenWidth, groundY, 3.0, color.RGBA{68, 92, 132, 255}, false)

	// Title Banner
	titleOp := &text.DrawOptions{}
	titleOp.LayoutOptions.PrimaryAlign = text.AlignCenter
	titleOp.ColorScale.ScaleWithColor(color.RGBA{255, 215, 60, 255})
	titleOp.GeoM.Translate(float64(ScreenWidth)/2, 80)
	text.Draw(screen, "ARCHER DUEL", &text.GoTextFace{
		Source: assets.TitleFont,
		Size:   56,
	}, titleOp)

	// Subtitle
	subOp := &text.DrawOptions{}
	subOp.LayoutOptions.PrimaryAlign = text.AlignCenter
	subOp.ColorScale.ScaleWithColor(color.RGBA{180, 210, 250, 220})
	subOp.GeoM.Translate(float64(ScreenWidth)/2, 150)
	text.Draw(screen, "Turn-Based Ballistic Archery Battle", &text.GoTextFace{
		Source: assets.TitleFont,
		Size:   20,
	}, subOp)

	// Draw Archer 1 preview on left (facing right)
	if len(assets.ArcherIdle) > 0 {
		frame1 := assets.ArcherIdle[t.idleFrame%len(assets.ArcherIdle)]
		op1 := &ebiten.DrawImageOptions{}
		op1.GeoM.Translate(-1000, -825)
		op1.GeoM.Scale(0.32, 0.32)
		op1.GeoM.Translate(230, float64(groundY))
		screen.DrawImage(frame1, op1)
	}

	// "VS" Badge in center
	vsOp := &text.DrawOptions{}
	vsOp.LayoutOptions.PrimaryAlign = text.AlignCenter
	vsOp.ColorScale.ScaleWithColor(color.RGBA{240, 80, 80, 255})
	vsOp.GeoM.Translate(float64(ScreenWidth)/2, float64(groundY)-80)
	text.Draw(screen, "VS", &text.GoTextFace{
		Source: assets.TitleFont,
		Size:   44,
	}, vsOp)

	// Draw Archer 2 preview on right (flipped facing left)
	if len(assets.Archer2Idle) > 0 {
		frame2 := assets.Archer2Idle[t.idleFrame%len(assets.Archer2Idle)]
		op2 := &ebiten.DrawImageOptions{}
		op2.GeoM.Translate(-1000, -825)
		op2.GeoM.Scale(-0.32, 0.32) // flipped facing left
		op2.GeoM.Translate(ScreenWidth-230, float64(groundY))
		screen.DrawImage(frame2, op2)
	}

	// Start Battle button
	if t.startButton != nil {
		t.startButton.Draw(screen)
	}
}
