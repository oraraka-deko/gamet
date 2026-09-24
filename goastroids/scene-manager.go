package goastroids

import "github.com/hajimehoshi/ebiten/v2"

var (
	transsitonFrom = ebiten.NewImage(ScreenWidth,ScreenHeight)
transsitonTo = ebiten.NewImage(ScreenWidth,ScreenHeight)
)

const transsitonMaxCount = 25

type Scene interface{
	Update(state *State)error
	Draw(screen *ebiten.Image)

}

type State struct{
	SceneManager *SceneManager
	Input *Input
}


type SceneManager struct{
	current Scene
	next Scene
	transsitionCount int
}

func (s *SceneManager) Draw(r *ebiten.Image){
	if s.transsitionCount ==0{
		s.current.Draw(r)
		return
	}
	transsitonFrom.Clear()
	s.current.Draw(transsitonFrom)

	transsitonTo.Clear()
	s.next.Draw(transsitonTo)
r.DrawImage(transsitonFrom,nil)

alpha := 1- float32(s.transsitionCount)/float32(transsitonMaxCount)
op := &ebiten.DrawImageOptions{}
op.ColorScale.ScaleAlpha(alpha)
r.DrawImage(transsitonTo,op)

}

func (s *SceneManager) Update(_ *Input)error{
	if s.transsitionCount ==0 {
	return	s.current.Update(&State{SceneManager: s})
	}
s.transsitionCount--
if s.transsitionCount >0 {
	return nil
}
s.current = s.next
s.next = nil
return nil
}

func (s *SceneManager) GoToScene(scene Scene){
if s.current ==nil{
	s.current=scene
} else{
	s.next=scene
	s.transsitionCount= transsitonMaxCount
}
}