import { For } from "solid-js";
import { RatingGroup } from "@ark-ui/solid/rating-group";
import Star from "lucide-solid/icons/star";

interface StarRatingProps {
  value: number;
  count?: number;
  readOnly?: boolean;
  size?: number;
  class?: string;
}

export const StarRating = (props: StarRatingProps) => {
  const size = () => props.size ?? 14;

  return (
    <RatingGroup.Root
      value={Math.round(props.value)}
      readOnly={props.readOnly ?? true}
      count={props.count ?? 5}
      class={props.class}
    >
      <RatingGroup.Control class="flex">
        <RatingGroup.Context>
          {(api) => (
            <For each={api().items}>
              {(item) => (
                <RatingGroup.Item index={item}>
                  <RatingGroup.ItemContext>
                    {(itemState) => (
                      <Star
                        size={size()}
                        class={
                          itemState().highlighted
                            ? "text-orange fill-orange"
                            : "text-muted-foreground"
                        }
                      />
                    )}
                  </RatingGroup.ItemContext>
                </RatingGroup.Item>
              )}
            </For>
          )}
        </RatingGroup.Context>
        <RatingGroup.HiddenInput />
      </RatingGroup.Control>
    </RatingGroup.Root>
  );
};
