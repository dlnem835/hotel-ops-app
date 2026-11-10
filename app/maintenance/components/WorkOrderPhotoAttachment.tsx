import OperationalPhoto from "@/app/lib/storage/OperationalPhoto";

type WorkOrderPhotoAttachmentProps = {
  photoUrl: string;
  className?: string;
  label?: string;
};

export default function WorkOrderPhotoAttachment({
  photoUrl,
  className,
  label = "Attached Photo",
}: WorkOrderPhotoAttachmentProps) {
  return (
    <div className={className}>
      <div
        style={{
          color: "#9CA3AF",
          fontSize: "12px",
          fontWeight: 700,
          marginBottom: "8px",
          textTransform: "uppercase",
          letterSpacing: "0.3px",
        }}
      >
        {label}
      </div>
      <OperationalPhoto
        src={photoUrl}
        alt="Work order attachment"
        linkStyle={{ display: "inline-block", maxWidth: "100%" }}
        imgStyle={{
          display: "block",
          maxWidth: "100%",
          maxHeight: "280px",
          width: "auto",
          borderRadius: "10px",
          border: "1px solid #3A352E",
          objectFit: "contain",
          background: "#111111",
        }}
      />
    </div>
  );
}
