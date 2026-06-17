import { ThemeToggle } from "@/components/theme/ThemeToggle";

type Props = {
  children: React.ReactNode;
};

export function AuthShell({ children }: Props) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-secondary/20 px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle compact />
      </div>
      {children}
    </div>
  );
}
