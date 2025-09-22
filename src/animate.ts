const TWO_PI = 2 * Math.PI;

export class WanderingAnt {
  private angle: number = Math.random() * TWO_PI;
  private angularVelocity: number = 0;

  constructor(
    private readonly damping: number = 0.98,
    private readonly noiseIntensity: number = 0.02,
    private readonly maxAngularVelocity: number = 0.1,
  ) {}

  getAngle(): number {
    // Add random impulse to angular velocity
    const noise = (Math.random() - 0.5) * 2 * this.noiseIntensity;
    this.angularVelocity = this.damping * this.angularVelocity + noise;

    // Optional: clamp angular velocity to prevent extremely fast spinning
    this.angularVelocity = Math.max(
      -this.maxAngularVelocity,
      Math.min(this.maxAngularVelocity, this.angularVelocity),
    );

    // Integrate angular velocity to get angle
    this.angle += this.angularVelocity;

    // Keep angle in [0, 2π] range (optional, for cleaner values)
    this.angle = ((this.angle % TWO_PI) + TWO_PI) % TWO_PI;

    return this.angle;
  }

  // Optional: get current angular velocity for debugging
  getAngularVelocity(): number {
    return this.angularVelocity;
  }

  // Optional: reset to initial state
  reset(): void {
    this.angle = 0;
    this.angularVelocity = 0;
  }
}
