import SvgIcon, { type IconProps } from "./SvgIcon.tsx";

export default function DiscordIcon(props: IconProps) {
    return (
        <SvgIcon {...props}>
            <path d="M9 6.75c-1.5.25-2.9.7-4.2 1.4C3 11 2.4 13.8 2.6 16.6c1.4 1.05 2.9 1.8 4.5 2.25l1.15-1.85" />
            <path d="M15 6.75c1.5.25 2.9.7 4.2 1.4 1.8 2.85 2.4 5.65 2.2 8.45-1.4 1.05-2.9 1.8-4.5 2.25l-1.15-1.85" />
            <path d="M7.5 16.25c2.9 1.2 6.1 1.2 9 0M8.25 8.5c2.4-.8 5.1-.8 7.5 0" />
            <circle cx="9.25" cy="12.75" r="1.1" />
            <circle cx="14.75" cy="12.75" r="1.1" />
        </SvgIcon>
    );
}
