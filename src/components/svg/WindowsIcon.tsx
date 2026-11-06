import SvgIcon, { type IconProps } from "./SvgIcon.tsx";

export default function WindowsIcon(props: IconProps) {
    return (
        <SvgIcon {...props}>
            <path d="M3 5.5 10.5 4.4v7.1H3zM13 4.05 21 3v8.5h-8zM3 13.5h7.5v7.1L3 19.5zM13 13.5h8V21l-8-1.05z" />
        </SvgIcon>
    );
}
