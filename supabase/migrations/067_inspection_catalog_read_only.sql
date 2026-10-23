-- Migration 067: Global inspection catalog is read-only for hotel users.
-- inspection_templates / categories / items stay readable by authenticated
-- users. INSERT/UPDATE/DELETE for authenticated is removed so ordinary hotel
-- staff cannot change the shared catalog. Service role (API / platform admin)
-- bypasses RLS and is unchanged. property_inspection_templates is not touched.

BEGIN;

ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert inspection_templates"
  ON public.inspection_templates;
DROP POLICY IF EXISTS "Authenticated users can update inspection_templates"
  ON public.inspection_templates;
DROP POLICY IF EXISTS "Authenticated users can delete inspection_templates"
  ON public.inspection_templates;

DROP POLICY IF EXISTS "Authenticated users can insert inspection_template_categories"
  ON public.inspection_template_categories;
DROP POLICY IF EXISTS "Authenticated users can update inspection_template_categories"
  ON public.inspection_template_categories;
DROP POLICY IF EXISTS "Authenticated users can delete inspection_template_categories"
  ON public.inspection_template_categories;

DROP POLICY IF EXISTS "Authenticated users can insert inspection_template_items"
  ON public.inspection_template_items;
DROP POLICY IF EXISTS "Authenticated users can update inspection_template_items"
  ON public.inspection_template_items;
DROP POLICY IF EXISTS "Authenticated users can delete inspection_template_items"
  ON public.inspection_template_items;

COMMIT;
