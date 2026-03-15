import { Component, OnInit, inject } from '@angular/core';
import utpl, { URITemplate } from 'uri-templates';
import { AppService, RequestHeader } from '../app.service';
import { Command, EventType, HttpRequestEvent, RequestService, UriTemplateParameter } from './request.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-uri-input',
  templateUrl: './request.component.html',
  styleUrls: ['./request.component.css'],
  imports: [FormsModule],
})
export class RequestComponent implements OnInit {
  uri: string;
  isUriTemplate: boolean;
  templatedUri: string;
  uriTemplateParameters: UriTemplateParameter[];
  httpRequestEvent: HttpRequestEvent = new HttpRequestEvent(EventType.FillHttpRequest, Command.Post, '');
  originalRequestUri: string;
  newRequestUri: string;
  requestBody: string;
  selectedHttpMethod: Command;
  commandPlaceholder = Command;
  requestHeaders: RequestHeader[];
  tempRequestHeaders: RequestHeader[];
  hasCustomRequestHeaders: boolean;
  isLoading = false;

  private readonly appService = inject(AppService);
  private readonly requestService = inject(RequestService);

  ngOnInit() {
    this.uri = this.appService.getUri();
    this.tempRequestHeaders = this.appService.getCustomRequestHeaders();

    this.requestService.getLoadingObservable().subscribe(loading => {
      this.isLoading = loading;
    });

    this.requestService.getNeedInfoObservable().subscribe((value: any) => {
      if (value.type === EventType.FillHttpRequest) {
        const event: HttpRequestEvent = value as HttpRequestEvent;
        this.httpRequestEvent = event;
        this.requestBody = '{\n\n}';
        this.selectedHttpMethod = event.command;
        this.templatedUri = undefined;
        this.isUriTemplate = RequestComponent.isUriTemplated(event.uri);
        this.originalRequestUri = event.uri;
        if (this.isUriTemplate) {
          const uriTemplate: URITemplate = utpl(event.uri);
          this.uriTemplateParameters = [];
          for (const param of uriTemplate.varNames) {
            this.uriTemplateParameters.push(new UriTemplateParameter(param, ''));
          }
          this.templatedUri = event.uri;
          this.computeUriFromTemplate();
        } else {
          this.newRequestUri = event.uri;
        }

        const element = document.getElementById('HttpRequestTrigger');
        if (element) {
          element.click();
        }
      }
    });

    // Subscribe to URI changes to update the input field
    // Don't make HTTP requests here - only update the display
    this.appService.uriObservable.subscribe(url => {
      this.uri = url;
      // Only make HTTP request if this came from browser navigation (back/forward)
      // not from programmatic setUri calls during HTTP requests
      if (this.appService.isFromBrowserNavigation()) {
        this.requestService.getUri(url);
      }
    });
    this.appService.requestHeadersObservable.subscribe(requestHeaders => {
      this.tempRequestHeaders = requestHeaders;
      this.updateRequestHeaders();
    });

    this.updateRequestHeaders();
    this.getUri();
  }

  getUri() {
    this.requestService.getUri(this.uri);
  }

  getExpandedUri() {
    this.requestService.getUri(this.newRequestUri);
  }

  makeHttpRequest() {
    // Blur the active element to prevent aria-hidden accessibility violation
    // when Bootstrap closes the modal
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.requestService.requestUri(this.newRequestUri, Command[this.selectedHttpMethod], this.requestBody);
  }

  handleModalKeydown(event: KeyboardEvent, form: any) {
    if (event.key === 'Enter') {
      // Don't submit if focus is in a textarea (body field) - allow multiline input
      const target = event.target as HTMLElement;
      if (target?.tagName === 'TEXTAREA') {
        return;
      }

      event.preventDefault();
      // Check if the form is valid before submitting
      if (form?.valid) {
        // Click the Go button which will submit and close the modal
        const goButton = document.getElementById('requestDialogGoButton');
        if (goButton) {
          goButton.click();
        }
      }
    }
  }

  blurActiveElement() {
    // Blur the active element to prevent aria-hidden accessibility violation
    // when Bootstrap closes the modal
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  goFromHashChange(uri: string) {
    this.uri = uri;
    this.requestService.getUri(this.uri);
  }

  computeUriFromTemplate() {
    const uriTemplate = utpl(this.templatedUri);
    const templateParams = {};
    for (const parameter of this.uriTemplateParameters) {
      if (parameter.value.length > 0) {
        templateParams[parameter.key] = parameter.value;
      }
    }
    this.newRequestUri = uriTemplate.fill(templateParams);
  }

  private static isUriTemplated(uri: string) {
    const uriTemplate = utpl(uri);
    return uriTemplate.varNames.length > 0;
  }

  showEditHeadersDialog() {
    this.tempRequestHeaders = [];
    for (let i = 0; i < 5; i++) {
      if (this.requestHeaders.length > i) {
        this.tempRequestHeaders.push(new RequestHeader(this.requestHeaders[i].key, this.requestHeaders[i].value));
      } else {
        this.tempRequestHeaders.push(new RequestHeader('', ''));
      }
    }

    document.getElementById('requestHeadersModalTrigger').click();
  }

  updateRequestHeaders() {
    // Blur the active element to prevent aria-hidden accessibility violation
    // when Bootstrap closes the modal
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.requestHeaders = [];
    for (const requestHeader of this.tempRequestHeaders) {
      const key: string = requestHeader.key.trim();
      const value: string = requestHeader.value.trim();

      if (key.length > 0 && value.length > 0) {
        this.requestHeaders.push(new RequestHeader(key, value));
      }
    }
    this.processRequestHeaders();
  }

  clearRequestHeaders() {
    this.tempRequestHeaders = [];
    for (let i = 0; i < 5; i++) {
      this.tempRequestHeaders.push(new RequestHeader('', ''));
    }

    this.processRequestHeaders();
  }

  private processRequestHeaders() {
    this.requestService.setCustomHeaders(this.requestHeaders);
    this.hasCustomRequestHeaders = this.requestHeaders.length > 0;
    this.appService.setCustomRequestHeaders(this.requestHeaders);
  }

  setAcceptRequestHeader(value: string) {
    let acceptHeaderSet = false;
    for (let i = 0; i < 5; i++) {
      if (this.tempRequestHeaders[i].key.toLowerCase() === 'accept') {
        this.tempRequestHeaders[i].value = value;
        acceptHeaderSet = true;
        break;
      }
    }
    if (!acceptHeaderSet) {
      for (let i = 0; i < 5; i++) {
        if (this.tempRequestHeaders[i].key === '') {
          this.tempRequestHeaders[i].key = 'Accept';
          this.tempRequestHeaders[i].value = value;
          break;
        }
      }
    }
  }
}
