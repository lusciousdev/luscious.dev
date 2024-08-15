

class Point 
{
  constructor(x, y)
  {
    this.x = x;
    this.y = y;
  }

  add(other)
  {
    this.x += other.x;
    this.y += other.y;

    return this;
  }

  addX(val)
  {
    this.x += val;
    return this;
  }

  addY(val)
  {
    this.y += val;
    return this;
  }

  sub(other)
  {
    this.x -= other.x;
    this.y -= other.y;

    return this;
  }

  subX(val)
  {
    this.x -= val;
    return this;
  }

  subY(val)
  {
    this.y -= val;
    return this;
  }

  div(divisor)
  {
    this.x /= divisor;
    this.y /= divisor;

    return this;
  }

  mult(multiplier)
  {
    this.x *= multiplier;
    this.y *= multiplier;

    return this;
  }

  angle()
  {
    var angle = 0;
    if (this.x == 0)
      angle = (this.y >= 0) ? (Math.PI / 2) : (3 * Math.PI / 2);
    else
      angle = Math.atan(this.y / this.x);

    if (this.x < 0)
      angle += Math.PI;

    return angle;
  }

  magnitude()
  {
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
  }

  rotate(angle)
  {
    var r = this.magnitude();
    var currAngle = this.angle();

    var newAngle = currAngle + angle;

    this.x = r * Math.cos(newAngle);
    this.y = r * Math.sin(newAngle);

    return this;
  }

  static add2(p1, p2)
  {
    return new Point(p1.x + p2.x, p1.y + p2.y);
  }

  static sub2(p1, p2)
  {
    return new Point(p1.x - p2.x, p1.y - p2.y);
  }
}

function distance(x1, y1, x2, y2)
{
  return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
}