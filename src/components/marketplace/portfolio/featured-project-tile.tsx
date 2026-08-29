interface FeaturedProjectTileProps {
  src: string;
  alt: string;
}

export const FeaturedProjectTile = (props: FeaturedProjectTileProps) => (
  <div class="aspect-video bg-muted rounded-lg overflow-hidden">
    <img
      class="w-full h-full object-cover hover:opacity-90 transition-opacity"
      src={props.src}
      alt={props.alt}
    />
  </div>
);
