import { TemplateEditor } from "@/components/instantly/template-editor";

export default function MhdTemplatePage() {
  return (
    <TemplateEditor
      title="MHD Template"
      description="Edit the MHD Tech Instantly campaign email template."
      channel="MHD Tech"
      fetchEndpoint="/instantly/templates/mhd"
    />
  );
}

