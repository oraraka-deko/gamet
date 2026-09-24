package assets

import (
	"bytes"
	"embed"
	"image"
	_ "image/png"
	"io/fs"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/text/v2"
)

//go:embed *
var assets embed.FS

var PlayerSprite = mustLoadImage("images/player.png")
var TitleFont = mustLoadFont("fonts/title.ttf")
var MeteoresSprites = mustLoadImages("images/meteors/*.png")

var MeteoresSpritesSmall = mustLoadImages("images/meteors-small/*.png")

var ArcherIdle = mustLoadImages("archer/1/Elf_01__IDLE_*.png")
var ArcherAttack = mustLoadImages("archer/1/Elf_01__ATTACK_*.png")
var ArcherHurt = mustLoadImages("archer/1/Elf_01__HURT_*.png")
var ArcherDie = mustLoadImages("archer/1/Elf_01__DIE_*.png")

var Archer2Idle = mustLoadImages("archer/2/Elf_02__IDLE_*.png")
var Archer2Attack = mustLoadImages("archer/2/Elf_02__ATTACK_*.png")
var Archer2Hurt = mustLoadImages("archer/2/Elf_02__HURT_*.png")
var Archer2Die = mustLoadImages("archer/2/Elf_02__DIE_*.png")

var ArrowSprite = mustLoadImage("arrows/without_shadow/1.png")
var ExplosionSprite = mustLoadImage("images/explosion.png")
//var FaceFont = FaceNewFont("fonts/title.ttf")
// func FaceNewFont(name string) font.Face {
// 	buf, err := assets.ReadFile(name)
// 	if err != nil {
// 		panic(err)
// 	}

// 	parsedFont, err := opentype.Parse(buf)
// 	if err != nil {
// 		panic(err)
// 	}
// 	tt, err := opentype.NewFace(parsedFont, &opentype.FaceOptions{
// 		Size:    24,
// 		DPI:     72,
// 		Hinting: font.HintingFull,
// 	})
// 	if err != nil {
// 		panic(err)
// 	}
	
// 	return tt
// }
func mustLoadImages(path string) []*ebiten.Image{
matches , err := fs.Glob(assets,path)
if err!=nil {
	panic(err)
}
images := make([]*ebiten.Image, len(matches))
for i , match:= range matches{
images[i] = mustLoadImage(match)
}
return images
}
func mustLoadFont(name string) *text.GoTextFaceSource {
	buf, err := assets.ReadFile(name)
	if err != nil {
		panic(err)
	}
	re := bytes.NewReader(buf)
ts ,err := text.NewGoTextFaceSource(re)
if err !=nil{
	panic(err)
}
return ts
}

func mustLoadImage(name string ) *ebiten.Image{
	f, err := assets.Open(name)
	if err!=nil{
		panic(err)
	}
	defer f.Close()
	img,_ ,err:= image.Decode(f)
	if err!=nil{
		panic(err)

	}
return ebiten.NewImageFromImage(img)
}