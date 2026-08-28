alter table tasks add column if not exists reminder_time text;

alter table tasks
  add constraint tasks_reminder_time_format
  check (reminder_time is null or reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
