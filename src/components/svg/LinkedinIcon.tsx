import SvgIcon, { type IconProps } from "./SvgIcon.tsx";

/* Outline after Lucide's former linkedin icon (ISC). */
export default function LinkedinIcon(props: IconProps) {
    return (
        <SvgIcon {...props}>
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
            <rect x="2" y="9" width="4" height="12" />
            <circle cx="4" cy="4" r="2" />
        </SvgIcon>
    );
}
