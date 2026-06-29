type WorkOrderPhotoAttachmentProps = {
  photoUrl: string;
  className?: string;
};

export default function WorkOrderPhotoAttachment({
  photoUrl,
  className,
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
        Attached Photo
      </div>
      <a
        href={photoUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "inline-block", maxWidth: "100%" }}
      >
        <img
          src={photoUrl}
          alt="Work order attachment"
          style={{
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
      </a>
    </div>
  );
}
