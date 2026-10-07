// Ported from goastroids/vector.go

export class Vector {
  constructor(x = 0, y = 0) {
    this.X = x;
    this.Y = y;
  }

  Normalize() {
    const magnitude = Math.sqrt(this.X * this.X + this.Y * this.Y);
    if (magnitude === 0) {
      return new Vector(0, 0);
    }
    return new Vector(this.X / magnitude, this.Y / magnitude);
  }
}

