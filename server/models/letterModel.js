const db = require('../config/db');

const listLetters = async () => {
  const result = await db.query(`
    SELECT
      request.*,
      applicant.record AS applicant,
      template.record AS template,
      COALESCE(template.fields, '[]'::jsonb) AS template_fields,
      COALESCE(values_by_field.field_values, '{}'::jsonb) AS submitted_values,
      generated.record AS generated
    FROM letter_requests request
    LEFT JOIN LATERAL (
      SELECT to_jsonb(item) - 'letter_id' AS record
      FROM letter_applicants item
      WHERE item.letter_id = request.id AND item.is_primary
      LIMIT 1
    ) applicant ON true
    LEFT JOIN LATERAL (
      SELECT
        to_jsonb(item) - 'letter_id' AS record,
        COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', field.id,
            'key', field.field_key,
            'label', field.field_label,
            'type', field.field_type,
            'required', field.is_required,
            'placeholder', field.placeholder,
            'helpText', field.help_text,
            'options', field.options
          ) ORDER BY field.position
        ) FILTER (WHERE field.id IS NOT NULL), '[]'::jsonb) AS fields
      FROM letter_request_templates item
      LEFT JOIN letter_request_fields field ON field.template_id = item.id
      WHERE item.letter_id = request.id
      GROUP BY item.id
    ) template ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_object_agg(field.field_key, value.field_value) AS field_values
      FROM letter_request_values value
      JOIN letter_request_fields field ON field.id = value.field_id
      WHERE value.letter_id = request.id
    ) values_by_field ON true
    LEFT JOIN LATERAL (
      SELECT to_jsonb(item) - 'letter_id' AS record
      FROM generated_letters item
      WHERE item.letter_id = request.id
      LIMIT 1
    ) generated ON true
    ORDER BY request.created_at DESC NULLS LAST, request.id DESC
  `);
  return result.rows;
};

module.exports = { listLetters };
