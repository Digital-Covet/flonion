import Mail from "lucide-solid/icons/mail";

interface ContactRowProps {
  name: string;
  role: string;
  avatar: string;
  onMail?: () => void;
}

export const ContactRow = (props: ContactRowProps) => (
  <div class="flex items-center gap-4">
    <div class="w-12 h-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
      <img
        class="w-full h-full object-cover"
        src={props.avatar}
        alt={props.name}
      />
    </div>
    <div class="min-w-0">
      <h4 class="text-sm font-medium text-foreground truncate">{props.name}</h4>
      <p class="text-sm text-muted-foreground truncate">{props.role}</p>
    </div>
    <button
      type="button"
      onClick={props.onMail}
      class="ml-auto p-2 rounded-full text-primary hover:bg-positive-muted transition-colors"
      aria-label={`Email ${props.name}`}
    >
      <Mail size={20} />
    </button>
  </div>
);
