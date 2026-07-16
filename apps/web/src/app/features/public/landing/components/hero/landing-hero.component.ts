import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ViewChild, afterNextRender } from '@angular/core';

@Component({
  selector: 'app-landing-hero',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-hero.component.html',
  styleUrl: './landing-hero.component.scss',
})
export class LandingHeroComponent {
  @ViewChild('tiltContainer') tiltContainerRef!: ElementRef<HTMLElement>;

  constructor() {
    afterNextRender(() => {
      this.initTilt();
    });
  }

  private initTilt(): void {
    const container = this.tiltContainerRef?.nativeElement;
    if (!container) return;

    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    if (isTouchDevice) {
      this.initGyroscope(container);
    } else {
      this.initMouseTilt(container);
    }
  }

  private initMouseTilt(container: HTMLElement): void {
    container.addEventListener('mousemove', (e: MouseEvent) => {
      container.classList.add('is-tilting');
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -4;
      const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 4;

      const wrapper = container.querySelector('.tilt-wrapper') as HTMLElement;
      if (wrapper) wrapper.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      container.querySelectorAll<HTMLElement>('.tilt-layer').forEach(layer => {
        const depth = parseFloat(layer.dataset['depth'] ?? '1');
        const tx = ((x - rect.width / 2) / (rect.width / 2)) * (15 * depth);
        const ty = ((y - rect.height / 2) / (rect.height / 2)) * (15 * depth);
        layer.style.transform = `translate(${tx}px, ${ty}px)`;
      });
    });

    container.addEventListener('mouseleave', () => {
      container.classList.remove('is-tilting');
      const wrapper = container.querySelector('.tilt-wrapper') as HTMLElement;
      if (wrapper) wrapper.style.transform = 'rotateX(0deg) rotateY(0deg)';
      container.querySelectorAll<HTMLElement>('.tilt-layer').forEach(layer => {
        layer.style.transform = 'translate(0px, 0px)';
      });
    });
  }

  private initGyroscope(container: HTMLElement): void {
    const wrapper = container.querySelector('.tilt-wrapper') as HTMLElement;
    const layers = Array.from(container.querySelectorAll<HTMLElement>('.tilt-layer'));

    let rafId = 0;
    let targetNx = 0, targetNy = 0;
    let currentNx = 0, currentNy = 0;

    const animate = () => {
      currentNx += (targetNx - currentNx) * 0.1;
      currentNy += (targetNy - currentNy) * 0.1;

      if (wrapper) wrapper.style.transform = `rotateX(${currentNy * -4}deg) rotateY(${currentNx * 4}deg)`;
      layers.forEach(layer => {
        const depth = parseFloat(layer.dataset['depth'] ?? '1');
        layer.style.transform = `translate(${currentNx * 15 * depth}px, ${currentNy * 15 * depth}px)`;
      });

      rafId = requestAnimationFrame(animate);
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = Math.max(-30, Math.min(30, e.gamma ?? 0));
      const beta  = Math.max(30,  Math.min(90,  e.beta  ?? 60));
      targetNx = gamma / 30;
      targetNy = (beta - 60) / 30;
    };

    const startGyro = () => {
      window.addEventListener('deviceorientation', handleOrientation);
      container.classList.add('is-tilting');
      rafId = requestAnimationFrame(animate);
    };

    // iOS 13+ requires a user gesture to request permission
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      const requestGyro = () => {
        (DeviceOrientationEvent as any).requestPermission()
          .then((state: string) => {
            if (state === 'granted') startGyro();
          })
          .catch(() => {/* permission denied or not available */});
      };
      // 'click' is more reliable than 'touchstart' on iOS Safari for non-interactive elements
      container.addEventListener('click', requestGyro, { once: true });
      container.addEventListener('touchend', requestGyro, { once: true });
      container.style.cursor = 'pointer';
    } else {
      startGyro();
    }
  }
}
