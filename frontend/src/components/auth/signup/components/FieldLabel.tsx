type FieldLabelProps = {
  text: string
  required?: boolean
  optional?: boolean
}

export default function FieldLabel({
  text,
  required,
  optional,
}: FieldLabelProps) {
  return (
    <div className="ff-signup-label-row">
      <label>
        {text}
        {required && <b>*</b>}
      </label>

      {optional && <span>선택</span>}
    </div>
  )
}