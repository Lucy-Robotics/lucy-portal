export interface TimelineItem {
  done?: boolean;
  position: number;
  title: string;
  link?: {
    href: string;
    text: string;
  };
  description: string;
}
