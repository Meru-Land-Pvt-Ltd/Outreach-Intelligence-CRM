import { TemplateEditor } from "@/components/instantly/template-editor";

export default function EnoylityTemplatePage() {
  return (
    <TemplateEditor
      title="Enoylity Template"
      description="Edit the Enoylity Instantly campaign email template."
      channel="Enoylity Technology"
      fetchEndpoint="/instantly/templates/enoylity"
    />
  );
}
