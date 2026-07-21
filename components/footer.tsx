"use client";

export default function Footer() {
  return (
    <footer className="bg-muted/30 border-t border-border/30">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <span className="font-medium text-primary">Botivate</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
