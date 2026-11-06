import SvgIcon, { type IconProps } from "./SvgIcon.tsx";

export default function PythonIcon(props: IconProps) {
    return (
        <SvgIcon {...props}>
            <path d="M12 2.75c-3 0-4.5 1-4.5 3v2.5H12V9H5.75c-2 0-3 1.5-3 3.75s1 3.75 3 3.75H7.5V14c0-1.6 1.2-2.75 2.75-2.75h4c1.4 0 2.5-1.1 2.5-2.5V5.75c0-2-1.8-3-4.75-3z" />
            <path d="M12 21.25c3 0 4.5-1 4.5-3v-2.5H12V15h6.25c2 0 3-1.5 3-3.75s-1-3.75-3-3.75H16.5V10c0 1.6-1.2 2.75-2.75 2.75h-4c-1.4 0-2.5 1.1-2.5 2.5v3c0 2 1.8 3 4.75 3z" />
            <circle cx="10" cy="5.5" r=".5" fill="currentColor" />
            <circle cx="14" cy="18.5" r=".5" fill="currentColor" />
        </SvgIcon>
    );
}
