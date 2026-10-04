type BrandLogoProps = {
  tone?: 'light' | 'dark';
  className?: string;
  showWineCellarsName?: boolean;
};

export function BrandLogo({
  tone = 'light',
  className = '',
  showWineCellarsName = false,
}: BrandLogoProps) {
  const source = `${import.meta.env.BASE_URL}kessick-logo-${tone === 'light' ? 'white' : 'black'}.svg`;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <img
        src={source}
        alt="Kessick Wine Cellars"
        className={className}
      />
      {showWineCellarsName ? (
        <span className="text-[8px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-foreground">
          Wine
          <br />
          Cellars
        </span>
      ) : null}
    </span>
  );
}