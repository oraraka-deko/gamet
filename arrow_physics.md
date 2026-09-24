To make an arrow feel realistic, simple parabolic kinematics ($y = v_0 t - \frac{1}{2}gt^2$) isn't enough. Real arrows behave distinctly due to three forces:

1. **Gravity:** Pulls the arrow downward ($g$).
2. **Aerodynamic Drag:** Air resistance acts in the direct opposite direction of velocity ($F_d \propto v^2$). This prevents the descent from being symmetric with the ascent.
3. **Aerodynamic Alignment (Weather-vaning):** The fletchings (feathers) create more drag at the tail than at the arrowhead, naturally torqueing the arrow to face directly into its velocity vector ($\theta = \text{atan2}(v_y, v_x)$).

---

### The Underlying Physics Equations

In standard Euler or Verlet integration per tick ($dt$):

1. **Speed:**

$$v = \sqrt{v_x^2 + v_y^2}$$


2. **Drag Force:**

$$F_{\text{drag}} = \frac{1}{2} C_d \cdot \rho \cdot A \cdot v^2$$



For game physics, simplify $\frac{1}{2} C_d \rho A$ into a single tuning constant $k$:

$$a_{\text{drag}, x} = -k \cdot v \cdot v_x$$


$$a_{\text{drag}, y} = -k \cdot v \cdot v_y$$


3. **Total Accelerations:**

$$a_x = a_{\text{drag}, x}$$


$$a_y = g + a_{\text{drag}, y}$$


4. **Angle Alignment (Pitch):**

$$\text{Angle} = \text{atan2}(v_y, v_x)$$


5. **Impaling into the Ground:**
When the tip penetrates the terrain, freeze the arrow's position and velocity, locking its final angle.

---

### Interactive Ballistics Simulation

Here is a sandbox showing how arrow flight works with drag, pitch alignment, and ground penetration:

---

### Implementation in Go (Ebitengine)

Here is a production-ready, modular Go implementation using Ebitengine:

```go
package main

import (
	"image/color"
	"log"
	"math"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/vector"
)

const (
	screenWidth  = 640
	screenHeight = 360
	groundY      = 300.0 // Ground level in screen pixels
	gravity      = 450.0 // Pixels/sec^2
	dragCoeff    = 0.0018 // Air resistance constant (k)
)

type ArrowState int

const (
	Flying ArrowState = iota
	Stuck
)

type Arrow struct {
	X, Y     float64
	VX, VY   float64
	Angle    float64 // Radians
	Length   float64
	State    ArrowState
	Trail    [][2]float64
}

func NewArrow(startX, startY, speed, angleDeg float64) *Arrow {
	rad := angleDeg * (math.Pi / 180.0)
	return &Arrow{
		X:      startX,
		Y:      startY,
		VX:     speed * math.Cos(rad),
		VY:     -speed * math.Sin(rad), // Negative because screen Y is inverted
		Angle:  -rad,
		Length: 28.0,
		State:  Flying,
		Trail:  make([][2]float64, 0, 100),
	}
}

func (a *Arrow) Update(dt float64) {
	if a.State == Stuck {
		return
	}

	// 1. Calculate current scalar speed
	speed := math.Hypot(a.VX, a.VY)

	// 2. Drag acceleration opposing velocity: a_drag = -k * speed * v
	ax := -dragCoeff * speed * a.VX
	ay := gravity - (dragCoeff * speed * a.VY)

	// 3. Integrate position & velocity (Semi-implicit Euler)
	a.VX += ax * dt
	a.VY += ay * dt
	a.X += a.VX * dt
	a.Y += a.VY * dt

	// 4. Align pitch directly with current trajectory
	a.Angle = math.Atan2(a.VY, a.VX)

	// 5. Save trail point
	a.Trail = append(a.Trail, [2]float64{a.X, a.Y})

	// 6. Tip collision against ground:
	// Tip coordinates extend forward along the angle vector
	tipX := a.X + math.Cos(a.Angle)*(a.Length/2)
	tipY := a.Y + math.Sin(a.Angle)*(a.Length/2)

	if tipY >= groundY {
		// Embed arrow tip into the earth and freeze
		a.Y = groundY - math.Sin(a.Angle)*(a.Length/2)
		a.X = tipX - math.Cos(a.Angle)*(a.Length/2)
		a.VX = 0
		a.VY = 0
		a.State = Stuck
	}
}

func (a *Arrow) Draw(screen *ebiten.Image) {
	// Draw trajectory arc
	for i := 1; i < len(a.Trail); i++ {
		p1 := a.Trail[i-1]
		p2 := a.Trail[i]
		vector.StrokeLine(screen, float32(p1[0]), float32(p1[1]), float32(p2[0]), float32(p2[1]), 1.0, color.RGBA{100, 116, 139, 120}, false)
	}

	// Compute tip and tail relative to center (X, Y)
	cosA := math.Cos(a.Angle)
	sinA := math.Sin(a.Angle)
	halfLen := a.Length / 2

	tipX := float32(a.X + cosA*halfLen)
	tipY := float32(a.Y + sinA*halfLen)
	tailX := float32(a.X - cosA*halfLen)
	tailY := float32(a.Y - sinA*halfLen)

	// Arrow shaft
	vector.StrokeLine(screen, tailX, tailY, tipX, tipY, 2.0, color.RGBA{245, 158, 11, 255}, false)

	// Arrow head (small barb)
	headLen := float64(6.0)
	barbAngle1 := a.Angle + math.Pi*0.85
	barbAngle2 := a.Angle - math.Pi*0.85
	b1X := tipX + float32(math.Cos(barbAngle1)*headLen)
	b1Y := tipY + float32(math.Sin(barbAngle1)*headLen)
	b2X := tipX + float32(math.Cos(barbAngle2)*headLen)
	b2Y := tipY + float32(math.Sin(barbAngle2)*headLen)

	vector.StrokeLine(screen, tipX, tipY, b1X, b1Y, 1.5, color.RGBA{239, 68, 68, 255}, false)
	vector.StrokeLine(screen, tipX, tipY, b2X, b2Y, 1.5, color.RGBA{239, 68, 68, 255}, false)
}

type Game struct {
	arrows []*Arrow
}

func (g *Game) Update() error {
	dt := 1.0 / 60.0

	// Press Space to fire a new arrow
	if ebiten.IsKeyJustPressed(ebiten.KeySpace) {
		g.arrows = append(g.arrows, NewArrow(40, groundY-20, 480, 52))
	}

	for _, arrow := range g.arrows {
		arrow.Update(dt)
	}
	return nil
}

func (g *Game) Draw(screen *ebiten.Image) {
	screen.Fill(color.RGBA{15, 23, 42, 255})

	// Ground plane
	vector.DrawFilledRect(screen, 0, groundY, screenWidth, screenHeight-groundY, color.RGBA{30, 41, 59, 255}, false)
	vector.StrokeLine(screen, 0, groundY, screenWidth, groundY, 2.0, color.RGBA{71, 85, 105, 255}, false)

	for _, arrow := range g.arrows {
		arrow.Draw(screen)
	}
}

func (g *Game) Layout(w, h int) (int, int) {
	return screenWidth, screenHeight
}

func main() {
	game := &Game{}
	ebiten.SetWindowSize(screenWidth*2, screenHeight*2)
	ebiten.SetWindowTitle("Realistic Arrow Ballistics (Drag + Align)")
	if err := ebiten.RunGame(game); err != nil {
		log.Fatal(err)
	}
}

```

---

### Subtle Details That Make It Feel "Right"

* **Tip vs Center of Mass:** Notice that collision checks occur at the **tip** ($x + \frac{L}{2}\cos\theta$), but the mass rotates around the center or front-third of the shaft. Checking the center of mass will cause the arrow to clip half its body below the ground before stopping.
* **Angular Inertia (Smoothing):** Real fletchings don't instantaneously rotate the arrow. If you want a heavy, realistic longbow feel, interpolate the angle toward the target using a slerp or damped lerp:
```go
targetAngle := math.Atan2(a.VY, a.VX)
a.Angle += (targetAngle - a.Angle) * 0.15 // 0.15 = alignment torque factor

```


* **Ground Penetration Depth:** Hard surfaces stop the tip at $y = \text{groundY}$. For softer targets (dirt, flesh, wood), let the arrow travel an extra fraction of its length along its vector before setting `State = Stuck`.

---

### You might also want to explore:

* **The Archer's Paradox (Oscillation):** High-speed cameras show that arrows bend and vibrate like a tuning fork horizontally upon release before stabilizing. Adding a subtle high-frequency sinusoidal wobble to the shaft sprite during the first 0.2 seconds gives an authentic feel.
* **Continuous Collision Detection (CCD):** At high initial launch speeds ($>700 \text{ px/s}$), an arrow can completely jump past thin collision barriers between two frames. Using a raycast between $(x_t, y_t)$ and $(x_{t+dt}, y_{t+dt})$ prevents this tunneling entirely.