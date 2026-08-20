import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ContextDocumentService } from '@gitroom/nestjs-libraries/database/prisma/context-documents/context-document.service';
import { CONTEXT_DOCUMENT_MAX_BYTES } from '@gitroom/nestjs-libraries/upload/context-document.upload.validation';

@ApiTags('Context Documents')
@Controller('/context-documents')
export class ContextDocumentsController {
  constructor(private _contextDocumentService: ContextDocumentService) {}

  @Get('/')
  listDocuments(@GetOrgFromRequest() org: Organization) {
    return this._contextDocumentService.listDocuments(org.id);
  }

  @Post('/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: CONTEXT_DOCUMENT_MAX_BYTES,
      },
    })
  )
  uploadDocument(
    @GetOrgFromRequest() org: Organization,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this._contextDocumentService.uploadDocument(org.id, file);
  }

  @Get('/skills')
  listSkills(@GetOrgFromRequest() org: Organization) {
    return this._contextDocumentService.listSkills(org.id);
  }

  @Get('/skills/:slug')
  getSkill(
    @GetOrgFromRequest() org: Organization,
    @Param('slug') slug: string
  ) {
    return this._contextDocumentService.getSkillBySlug(org.id, slug);
  }

  @Get('/:id')
  getDocument(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._contextDocumentService.getDocumentById(org.id, id);
  }

  @Delete('/:id')
  deleteDocument(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._contextDocumentService.deleteDocument(org.id, id);
  }
}
