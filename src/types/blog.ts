export interface BlogPost {
  id:string;
  title: string;
  date: string;
  author: string;
  body: string;
  tags: string[];
}

export type BlogPostInput = Omit<BlogPost, "id" | "author" | "date">;
