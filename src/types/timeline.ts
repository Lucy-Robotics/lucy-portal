export interface TimelineItem {
  id: string;
  done?: boolean;
  position: number;
  title: string;
  link?: {
    href: string;
    text: string;
  };
  description: string;
}
