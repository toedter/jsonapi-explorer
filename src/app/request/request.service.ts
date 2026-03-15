import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import utpl, { URITemplate } from 'uri-templates';
import { AppService, RequestHeader } from '../app.service';

const DEFAULT_ACCEPT_HEADER = 'application/vnd.api+json, application/json, */*';

export enum EventType {
  FillHttpRequest,
}

export enum Command {
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Document,
}

export class HttpRequestEvent {
  constructor(
    public type: EventType,
    public command: Command,
    public uri: string
  ) {}
}

export class UriTemplateParameter {
  constructor(
    public key: string,
    public value: string
  ) {}
}

export class Response {
  constructor(
    public httpResponse: HttpResponse<any>,
    public httpErrorResponse: HttpErrorResponse
  ) {}
}

@Injectable({
  providedIn: 'root',
})
export class RequestService {
  private readonly responseSubject = new Subject<Response>();
  private readonly needInfoSubject = new Subject<any>();
  private readonly documentationSubject = new Subject<string>();
  private readonly loadingSubject = new Subject<boolean>();

  private requestHeaders = new HttpHeaders({ Accept: DEFAULT_ACCEPT_HEADER });
  private customRequestHeaders: RequestHeader[] = [];

  private readonly appService = inject(AppService);
  private readonly http = inject(HttpClient);

  getResponseObservable(): Observable<Response> {
    return this.responseSubject.asObservable();
  }

  getNeedInfoObservable(): Observable<any> {
    return this.needInfoSubject.asObservable();
  }

  getDocumentationObservable(): Observable<string> {
    return this.documentationSubject.asObservable();
  }

  getLoadingObservable(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  getUri(uri: string): void {
    if (!uri?.trim()) {
      return;
    }
    this.processCommand(Command.Get, uri);
  }

  requestUri(uri: string, httpMethod: string, body?: string, contentType?: string): void {
    this.setLoading(true);
    let headers = this.requestHeaders;

    const requiresContentType = contentType || ['post', 'put', 'patch'].includes(httpMethod.toLowerCase());

    if (requiresContentType) {
      headers = headers.set('Content-Type', contentType || 'application/vnd.api+json');
    } else {
      this.appService.setUri(uri);
    }

    this.http.request(httpMethod, uri, { headers, observe: 'response', body }).subscribe({
      next: (response: HttpResponse<any>) => {
        this.responseSubject.next(new Response(response, null));
        this.setLoading(false);
      },
      error: (error: HttpErrorResponse) => {
        this.responseSubject.next(new Response(null, error));
        this.setLoading(false);
      },
    });
  }

  processCommand(command: Command, uri: string): void {
    if (command === Command.Document) {
      this.documentationSubject.next(uri);
      return;
    }

    if (command === Command.Delete) {
      this.requestUri(this.expandUriTemplate(uri), 'DELETE');
      return;
    }

    if (command === Command.Get && !this.isUriTemplated(uri)) {
      this.requestUri(uri, 'GET');
      return;
    }

    if ([Command.Get, Command.Post, Command.Put, Command.Patch].includes(command)) {
      const event = new HttpRequestEvent(EventType.FillHttpRequest, command, uri);
      this.needInfoSubject.next(event);
    }
  }

  setCustomHeaders(requestHeaders: RequestHeader[]): void {
    this.customRequestHeaders = requestHeaders;
    this.requestHeaders = new HttpHeaders();

    let hasAcceptHeader = false;
    for (const requestHeader of requestHeaders) {
      if (requestHeader.key.toLowerCase() === 'accept') {
        hasAcceptHeader = true;
      }
      this.requestHeaders = this.requestHeaders.append(requestHeader.key, requestHeader.value);
    }

    if (!hasAcceptHeader) {
      this.requestHeaders = this.requestHeaders.append('Accept', DEFAULT_ACCEPT_HEADER);
    }
  }

  isUriTemplated(uri: string): boolean {
    const uriTemplate = utpl(uri);
    return uriTemplate.varNames.length > 0;
  }

  private expandUriTemplate(uri: string): string {
    if (!this.isUriTemplated(uri)) {
      return uri;
    }
    const uriTemplate: URITemplate = utpl(uri);
    return uriTemplate.fill({});
  }
}
