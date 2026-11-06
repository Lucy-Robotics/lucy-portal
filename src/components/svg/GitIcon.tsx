import SvgIcon, { type IconProps } from "./SvgIcon.tsx";

export default function GitIcon(props: IconProps) {
    return (
        <SvgIcon {...props}>
            <path d="M10.59 2.59a2 2 0 0 1 2.82 0l8 8a2 2 0 0 1 0 2.82l-8 8a2 2 0 0 1-2.82 0l-8-8a2 2 0 0 1 0-2.82z" />
            <path d="M7.5 5.5 10 8m1 2.1v4.3m1.2-5.3 1.8 1.8" />
            <circle cx="11" cy="9" r="1.1" />
            <circle cx="11" cy="15.5" r="1.1" />
            <circle cx="15" cy="12" r="1.1" />
        </SvgIcon>
    );
}
