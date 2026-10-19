type LogoProps = {
    className?: string;
};

export default function Logo({ className }: LogoProps) {
    return (
        <span className={`logo ${className ?? ""}`}>
            <img className="logo__mark" src="/logo-mark.png" alt="" aria-hidden="true" />
            <span className="logo__text">lucy</span>
        </span>
    );
}
