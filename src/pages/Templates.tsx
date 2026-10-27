import { Plus, Zap } from 'lucide-react';
import { useState } from 'react';
import { useTemplates } from '../api/templates';
import { PageHeader } from '../components/Layout';
import { TemplateSheet, TemplateTile, useApplyTemplate } from '../components/templates';
import { Button, Card, EmptyState, Skeleton } from '../components/ui';
import type { Template } from '../lib/types';

export default function Templates() {
  const { data: templates = [], isLoading } = useTemplates();
  const [editing, setEditing] = useState<{ template?: Template } | null>(null);
  const { apply, prompt } = useApplyTemplate();

  return (
    <div>
      <PageHeader title="Templates" subtitle="Save things you add often, then add them with one tap"
        actions={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New template</Button>} />

      {isLoading ? <Skeleton className="h-32" /> : templates.length === 0 ? (
        <Card>
          <EmptyState icon={<Zap className="h-6 w-6" />} title="No templates yet"
            text="Make one for things like rent, your salary, a daily tea or a phone recharge. Tap it any time to add it, dated today."
            action={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Create a template</Button>} />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">Tap to add today · the pencil edits · most used first</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <TemplateTile key={t.id} template={t} onApply={() => apply(t)} onEdit={() => setEditing({ template: t })} />
            ))}
          </div>
        </>
      )}

      {editing && <TemplateSheet template={editing.template} onClose={() => setEditing(null)} />}
      {prompt}
    </div>
  );
}
