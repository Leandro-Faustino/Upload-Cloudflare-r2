import fastify from "fastify";
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { r2 } from '../lib/cloudflare'
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from 'zod'
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { request } from "http";

const app = fastify()

const prisma = new PrismaClient()

app.post('/uploads', async (request) => {
  const uploadBodySchema = z.object({
    name: z.string().min(1),
    contentType: z.string().regex(/\w+\/[-+.\w]+/),
  })

  const { name, contentType } = uploadBodySchema.parse(request.body)

  const fileKey = randomUUID().concat('-').concat(name)

  const signedurl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: 'upload-dev',      // pasta criada no cloudflare
      Key: fileKey,            //nome do arquivo
      ContentType: contentType,    // tp conteúdo
    }),
    {expiresIn: 900}
  )
  const file = await prisma.file.create({
    data: {
      name,
      contentType,
      key: fileKey, 
    }


  })  

  return { signedurl, fileId: file.id }
})

app.get('/uploads/:id', async ( request ) => {
  const getFileParamsSchema = z.object({
    id: z.string().cuid()
  })
  const { id } = getFileParamsSchema.parse(request.params)

  const file = await prisma.file.findUniqueOrThrow({
    where: {
      id,
    }
  })

  const signedurl = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: 'bucket-name',      // pasta criada no cloudflare
      Key: file.key,            //nome do arquivo
    }),
    {expiresIn: 600}
  )
  return signedurl
})

app.listen({
  port: 3333,
  host: '0.0.0.0',
}).then(() => {
  console.log('🙌🏽 Http Server running');
  
})