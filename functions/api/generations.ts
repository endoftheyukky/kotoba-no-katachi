// POST /api/generations — the only public endpoint of the archive. It accepts
// one record and answers nothing about what is kept: there is no public read.
import { acceptGeneration } from '../../server/generations'

export const onRequest: PagesFunction<Env> = ({ request, env }) => acceptGeneration(request, env)
