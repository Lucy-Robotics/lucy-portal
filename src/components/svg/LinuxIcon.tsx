import SvgIcon, { type IconProps } from "./SvgIcon.tsx";

/* Tux, reduced to its outline. */
export default function LinuxIcon(props: IconProps) {
    return (
        <SvgIcon {...props}>
            <path d="M12 2.75c-2 0-3.25 1.6-3.25 3.75 0 1.6.4 2.6-.6 4.1-1.25 1.8-2.4 3.8-2.4 5.9 0 .7.1 1.3.3 1.85" />
            <path d="M12 2.75c2 0 3.25 1.6 3.25 3.75 0 1.6-.4 2.6.6 4.1 1.25 1.8 2.4 3.8 2.4 5.9 0 .7-.1 1.3-.3 1.85" />
            <path d="M4.5 18.75 6.75 17.5l2 1.75-1.75 2-2.5-1zM19.5 18.75l-2.25-1.25-2 1.75 1.75 2 2.5-1zM8.75 19.75c2.1.6 4.4.6 6.5 0" />
            <path d="M11 8.5h2l-1 1z" />
            <circle cx="10.75" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="13.25" cy="6.5" r=".5" fill="currentColor" />
        </SvgIcon>
    );
}
