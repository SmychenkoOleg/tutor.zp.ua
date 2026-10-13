/** Shared visibility rule for the mobile-only sticky consultation CTA. */
export interface StickyCtaState {
  viewportWidth: number;
  viewportHeight: number;
  scrollY: number;
  otherCtaVisible: boolean;
}

/**
 * Do not duplicate the hero CTA during the first screen. On later screens,
 * show the sticky CTA only when no in-page form CTA is sufficiently visible.
 * Menu, modal and cookie-banner visibility are handled at the component/CSS layer.
 */
export function shouldShowStickyCta({
  viewportWidth,
  viewportHeight,
  scrollY,
  otherCtaVisible,
}: StickyCtaState): boolean {
  return viewportWidth <= 820 &&
    scrollY >= Math.max(240, viewportHeight * 0.75) &&
    !otherCtaVisible;
}
