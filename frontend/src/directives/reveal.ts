import type { Directive } from 'vue'
import gsap from 'gsap'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return
      }
      const element = entry.target as HTMLElement
      const delay = Number(element.dataset.revealDelay ?? 0)
      gsap.to(element, {
        opacity: 1,
        y: 0,
        duration: 1.05,
        ease: 'power3.out',
        delay
      })
      observer.unobserve(element)
    })
  },
  { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
)

export const reveal: Directive<HTMLElement> = {
  mounted(element) {
    if (prefersReducedMotion) {
      element.style.opacity = '1'
      return
    }
    element.style.opacity = '0'
    element.style.transform = 'translateY(34px)'
    observer.observe(element)
  },
  unmounted(element) {
    observer.unobserve(element)
  }
}
