import { HiOutlineArrowTopRightOnSquare } from "react-icons/hi2";

/* Marks a link that opens another site. */
export default function ExternalLinkIcon({ className = "external-link-icon" }: { className?: string }) {
    return <HiOutlineArrowTopRightOnSquare className={className} size={14} aria-hidden="true" />;
}
