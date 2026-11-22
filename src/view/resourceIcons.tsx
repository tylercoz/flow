import type { ReactElement, SVGProps } from 'react'
import type { ResourceKind } from '../domain/ResourceKinds'

const SVG_PROPS: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

// Icons are decorative; the adjacent text names the kind, so they are hidden from assistive tech.
const ICONS: Record<ResourceKind, ReactElement> = {
  database: (
    <svg {...SVG_PROPS}>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </svg>
  ),
  // Git branch: a main line with a second branch forking off and merging back.
  repository: (
    <svg {...SVG_PROPS}>
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <path d="M6 7.5v9M18 10.5c0 4-12 2-12 6" />
    </svg>
  ),
  artifact: (
    <svg {...SVG_PROPS}>
      <path d="M6 3h8l4 4v14H6zM14 3v4h4" />
    </svg>
  ),
  // C4 person: round head over a rounded torso.
  user: (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3z" />
    </svg>
  ),
  // C4 component: a box with two port tabs on its left edge.
  component: (
    <svg {...SVG_PROPS}>
      <path d="M7 4h13v16H7zM3 9h8M3 15h8" />
    </svg>
  ),
  'input-object': (
    <svg {...SVG_PROPS}>
      <path d="M4 5h16v14H4zM8 10h8M8 14h5" />
    </svg>
  ),
}

export function ResourceIcon({ kind }: { kind: ResourceKind }): ReactElement {
  return ICONS[kind]
}
