select policyname, cmd, qual
from pg_policies
where tablename = 'registro_alumnos';
